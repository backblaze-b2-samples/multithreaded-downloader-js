class MultiThread {
  constructor (options = {}, onProgress = () => {}, onFinish = () => {}) {
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
    this.chunkSize *= 1048576 // Convert mb -> bytes
    this.numChunks = Math.ceil(this.contentLength / this.chunkSize)
    this.buffer = new ArrayBuffer(this.contentLength)
    this.bufferView = new Uint8Array(this.buffer)

    const self = this
    let chunkCount = 0
    let headers = this.headers || new Headers()
    const promiseProducer = function () {
      // If there is work left to be done, return the next work item as a promise.
      if (chunkCount < self.numChunks) {
        const start = chunkCount * self.chunkSize
        const end = start + self.chunkSize - 1
        headers.set('Range', `bytes=${start}-${end}`)
        chunkCount++

        return self.fetchRetry(self.url, {
          headers: headers,
          method: 'GET',
          mode: 'cors',
          signal: self.controller.signal
        }).then(response => {
          // Content-Range header not exposed by default in CORS requests, so fake it.
          return {response, contentRange: `bytes ${start}-${end}/${self.contentLength}`}
        })
          .then(self.concatStreams.bind(self))
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
      .then(() => {
        // console.log('All promises fulfilled', response)
        self.downloadStream(response)
        self.onFinish()
      }, function (error) {
        console.error(error)
      })

    // Return the original 'HEAD' response
    return response
  }

  concatStreams ({response, contentRange}) {
    contentRange = contentRange.split(' ')[1].split('/')[0]
    const start = parseInt(contentRange.split('-')[0])
    const end = Math.min(parseInt(contentRange.split('-')[1]), this.contentLength)

    // Map responses to arrayBuffers then reduce to single arrayBuffer for final response
    return response.arrayBuffer()
      .then(buffer => {
        this.bufferView.set(new Uint8Array(buffer), start)
        return new Response(response)
      })
      // TODO: fix monitorProgress
      // .then(this.monitorProgress.bind(this))
  }

  downloadStream (response) {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([this.buffer]))
    link.download = this.fileName
    link.dispatchEvent(new MouseEvent('click'))

    return new Response(response)
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

  // TODO: fix monitorProgress
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
        self.onProgress({loaded: 0, total: self.contentLength, id: progressID})

        function read () {
          self._reader.read().then(({done, value}) => {
            if (done) {
              // ensure onProgress called when content-length=0
              if (self.contentLength === 0) {
                self.onProgress({loaded, total: self.contentLength, id: progressID})
              }
              controller.close()
              return
            }

            loaded += value.byteLength
            self.onProgress({loaded, total: self.contentLength, id: progressID})
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
