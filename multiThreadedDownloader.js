// In cross-origin situations, the download attribute has to be combined with
// the `Content-Disposition` HTTP header, specifically with the attachment
// disposition type, to avoid the user being warned of possibly nefarious
// activity. (This is to protect users from being made to download sensitive
// personal or confidential information without their full understanding.)
class MultiThreadedDownloader {
  constructor (url, options = {
    concurrency: 2,
    chunkSize: 4,
    retries: 2,
    retryDelay: 1000,
    retryOn: []
  }) {
    if (!this.supported()) {
      console.error('Web Streams are not supported!')
      return
    }

    Object.assign(this, options)

    this.url = url
    this.pathname = this.url.pathname.split('/')
    this.fileName = this.fileName || this.pathname[this.pathname.length - 1]
    this.controller = new AbortController()
    this.progressElements = []

    // Convert mb -> bytes
    this.chunkSize *= 1048576

    // "Access-Control-Expose-Headers: Content-Length" must be enabled for HEAD requests!
    return this.fetchRetry(url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.headers,
      signal: this.controller.signal
    }).then(this.buildRangeRequests.bind(this))
    // .then(response => response.blob())
    // .then(blob => {
    //   let link = document.createElement('a')
    //   link.href = URL.createObjectURL(blob)
    //   link.download = this.fileName
    //   link.dispatchEvent(new MouseEvent('click'))
    // })
  }

  supported () {
    try {
      return !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (err) {
      return false
    }
  }

  // Returns a promise that fulfils into a new Response object
  buildRangeRequests (response) {
    // Google drive response headers are all lower case, B2's are not!
    const contentLength = parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))
    this.numChunks = Math.ceil(contentLength / this.chunkSize)

    let chunkCount = 0
    let headers = this.headers || new Headers()
    const promiseProducer = function () {
      // If there is work left to be done, return the next work item as a promise.
      if (chunkCount < this.numChunks) {
        headers.set('Range', `bytes=${chunkCount * this.chunkSize}-${(chunkCount * this.chunkSize) + this.chunkSize - 1}`)
        chunkCount++
        return this.fetchRetry(this.url, {
          headers: headers,
          method: 'GET',
          mode: 'cors',
          signal: this.controller.signal
        })
        // .then(response => this.respondWithProgressMonitor({ chunk: chunkCount + 1 }, response))
      }
      // Otherwise, return null to indicate that all promises have been created.
      return null
    }

    const pool = new PromisePool(promiseProducer.bind(this), this.concurrency)
    let responses = []

    pool.addEventListener('fulfilled', async function (event) {
      responses.push(event.data.result)
    })

    pool.addEventListener('rejected', function (event) {
      console.log('Rejected: ' + event.data.error.message)
    })

    const self = this
    const responseHeaders = new Headers(response.headers)
    responseHeaders.append('Content-Disposition', `attachment; filename="${this.fileName}"`)

    pool.start()
      .then(function () {
        console.log('All promises fulfilled')
        Promise.all(responses.map(response => response.arrayBuffer()))
          .then(buffers => new Response(buffers.reduce(self.concatTypedArray, new Uint8Array()), {responseHeaders}))
          .then(response => response.blob())
          .then(blob => {
            let link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = self.fileName
            link.dispatchEvent(new MouseEvent('click'))
          })
      }, function (error) {
        console.log('Some promise rejected: ' + error.message)
      })

    // Build range requests
    // let promises = []
    // let headers = this.headers || new Headers()
    // for (let chunkCount = 0; chunkCount < this.numChunks; chunkCount++) {
    //   headers.set('Range', `bytes=${chunkCount * this.chunkSize}-${(chunkCount * this.chunkSize) + this.chunkSize - 1}`)
    //   promises.push(this.fetchRetry(this.url, {
    //     headers: headers,
    //     method: 'GET',
    //     mode: 'cors',
    //     signal: this.controller.signal
    //   })
    //     // .then(response => this.respondWithProgressMonitor({ chunk: chunkCount + 1 }, response))
    //   )
    // }
    //
    // const responseHeaders = new Headers(response.headers)
    // responseHeaders.append('Content-Disposition', `attachment; filename="${this.fileName}"`)
    //
    // // Map respones to arrayBuffers, reduce to single arrayBuffer for final response
    // return Promise.all(promises)
    //   .then(responses => Promise.all(responses.map(response => response.arrayBuffer())))
    //   .then(buffers => new Response(buffers.reduce(this.concatTypedArray, new Uint8Array()), {responseHeaders}))
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

  // Concat two ArrayBuffers
  concatTypedArray (array1, array2) {
    const temp = new Uint8Array(array1.byteLength + array2.byteLength)
    temp.set(new Uint8Array(array1), 0)
    temp.set(new Uint8Array(array2), array1.byteLength)
    return temp.buffer
  }

  respondWithProgressMonitor (options, response) {
    const contentLength = response.headers.get('content-length')
    const total = parseInt(contentLength, 10)
    const reader = response.body.getReader()
    const updateProgress = this.updateProgress
    const els = this.progressElements
    let loaded = 0

    return new Response(new ReadableStream({
      start (controller) {
        // Await resolution of first read() progress is sent for indicator accuracy
        read()

        function read () {
          reader.read().then(({done, value}) => {
            if (done) {
              controller.close()
              return
            }

            controller.enqueue(value)
            loaded += value.byteLength
            updateProgress({loaded, total, chunk: options.chunk, url: response.url, els})
            read()
          }).catch(error => {
            // error only typically occurs if network fails mid-download
            // console.error(error)
            controller.error(error)
          })
        }
      },

      // Firefox excutes this on page stop, Chrome does not
      cancel (reason) {
        console.log('cancel()', reason)
      }
    }))
  }

  updateProgress ({loaded, total, chunk, url, els}) {
    // if (!this.progressElements[url + chunk]) {
    if (!els[url + chunk]) {
      let el = document.createElement('progress')
      el.classList.add('progressBar')
      els[url + chunk] = el
      document.getElementById('progressArea').appendChild(el)
    }
    els[url + chunk].value = loaded / total
  }
}
