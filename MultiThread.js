class MultiThread {
  constructor (options, onProgress, onFinish) {
    if (!this.supported()) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onProgress = onProgress.bind(this)
    this.onFinish = onFinish.bind(this)
  }

  supported () {
    try {
      return !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (error) {
      return false
    }
  }

  cancel () {
    this._cancelRequested = true
    this.controller.abort()
    if (this._reader) {
      return this._reader.cancel()
    }
    return Promise.resolve()
  }

  // mimic native fetch() and return Promise
  fetch (url, init = {}) {
    this.url = (url instanceof Request) ? url : new Request(url)
    this.buffer = new Uint8Array()
    this.controller = new AbortController()
    this._cancelRequested = false
    this.progressMeters = 0

    return this.fetchRetry(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: init.headers,
      signal: this.controller.signal
    }).then(this.fetchRanges.bind(this))
  }

  // Returns a promise that fulfils into a new Response object
  fetchRanges (response) {
    // Google drive response headers are all lower case, B2's are not!
    this.contentLength = parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))

    this.headResponse = response
    this.chunkSize *= 1048576 // Convert mb -> bytes
    this.numChunks = Math.ceil(this.contentLength / this.chunkSize)

    const self = this
    let chunkCount = 0
    let headers = this.headers || new Headers()
    const promiseProducer = function () {
      // If there is work left to be done, return the next work item as a promise.
      if (chunkCount < self.numChunks) {
        headers.set('Range', `bytes=${chunkCount * self.chunkSize}-${(chunkCount * self.chunkSize) + self.chunkSize - 1}`)
        chunkCount++

        return self.fetchRetry(self.url, {
          headers: headers,
          method: 'GET',
          mode: 'cors',
          signal: self.controller.signal
        })
          .then(self.concatStreams.bind(self))
          // .then(this.monitorProgress.bind(this))
      }
      // Otherwise, return null to indicate that all promises have been created.
      return null
    }

    const pool = new PromisePool(promiseProducer, this.threads)

    // pool.addEventListener('fulfilled', async function (event) {
    //   console.log('Fulfilled: ', event.data.result)
    // })

    // pool.addEventListener('rejected', function (event) {
    //   console.log('Rejected: ' + event.data.error.message)
    // })

    pool.start()
      .then(function () {
        // console.log('All promises fulfilled')
        self.downloadStream(response)
        self.onFinish()
      }, function (error) {
        console.log('Some promise rejected: ' + error.message)
      })

    // Return the original 'HEAD' response
    return response
  }

  concatStreams (response) {
    // Map responses to arrayBuffers then reduce to single arrayBuffer for final response
    return response.arrayBuffer()
      .then(buffer => {
        this.buffer = this.concatArrayBuffers(this.buffer, buffer)
        return new Response(response)
      })
      // .then(this.monitorProgress.bind(this))
  }

  concatArrayBuffers (array1, array2) {
    const temp = new Uint8Array(array1.byteLength + array2.byteLength)
    temp.set(new Uint8Array(array1), 0)
    temp.set(new Uint8Array(array2), array1.byteLength)
    return temp.buffer
  }

  downloadStream (response) {
    // Add 'Content-Disposition' to the original response headers
    const headers = new Headers(response.headers)
    headers.append('Content-Disposition', `attachment; filename="${this.fileName}"`)

    // The download attribute requires "Content-Disposition" HTTP header
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([this.buffer]))
    link.download = this.fileName
    link.dispatchEvent(new MouseEvent('click'))

    return response
  }

  fetchRetry (url, init) {
    const retries = this.retries
    const retryDelay = this.retryDelay
    const retryOn = this.retryOn || []

    return new Promise(function (resolve, reject) {
      function fetchAttempt (retriesRemaining) {
        fetch(url, init).then(function (response) {
          if (retryOn.indexOf(response.status) === -1) {
            resolve(response)
          } else {
            if (retriesRemaining > 0) {
              retry(retriesRemaining)
            } else {
              reject(response)
            }
          }
        }).catch(function (error) {
          if (retriesRemaining > 0) {
            retry(retriesRemaining)
          } else {
            reject(error)
          }
        })
      }

      function retry (retriesRemaining) {
        setTimeout(() => {
          fetchAttempt(--retriesRemaining)
        }, retryDelay)
      }

      fetchAttempt(retries)
    })
  }

  monitorProgress (response) {
    // this occurs if cancel() was called before server responded (before fetch() Promise resolved)
    if (this._cancelRequested) {
      response.body.getReader().cancel()
      return Promise.reject(new Error('Request was canceled before server responded.'))
    }

    let loaded = 0
    const self = this
    const progressID = this.progressMeters++
    this._reader = response.body.getReader()

    return new Response(new ReadableStream({
      start (controller) {
        if (self._cancelRequested) {
          controller.close()
          return
        }

        // Await resolution of first read() progress is sent for indicator accuracy
        read()
        // self.onProgress({loaded: 0, contentLength, id: progressID})

        function read () {
          self._reader.read().then(({done, value}) => {
            if (done) {
              // ensure onProgress called when content-length=0
              if (self.contentLength === 0) {
                self.onProgress({loaded, contentLength: self.contentLength, id: progressID})
              }
              controller.close()
              return
            }

            loaded += value.byteLength
            self.onProgress({loaded, contentLength: self.contentLength, id: progressID})
            controller.enqueue(value)
            read()
          }).catch(error => {
            console.error(error)
            controller.error(error)
          })
        }
      }
    }))
  }
}
