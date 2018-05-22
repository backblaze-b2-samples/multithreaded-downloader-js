class MultiThreadedDownloader {
  constructor (url, options = { threads: 4, retries: 3, retryDelay: 1000, retryOn: [] }) {
    if (!this.supported()) {
      console.error('Web Streams are not supported!')
      return
    }

    this.url = url
    this.pathname = url.pathname.split('/')
    this.fileName = this.pathname[this.pathname.length - 1]
    this.controller = new AbortController()
    this.progressElements = []

    Object.assign(this, options)

    // "Access-Control-Expose-Headers: Content-Length" must be enabled for HEAD requests!
    return this.fetchRetry(url, {
      method: 'HEAD',
      mode: 'cors',
      signal: this.controller.signal
    }).then(this.onHeadResponse.bind(this))
      .then(response => response.blob()).then(blob => {
        let link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = this.fileName
        link.dispatchEvent(new MouseEvent('click'))
      })
  }

  supported () {
    try {
      return !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (err) {
      return false
    }
  }

  // Triggers when a HEAD request is successful. Returns a promise that fulfils into a new Response object
  onHeadResponse (response) {
    // Google drive response headers are all lower case, B2's are not!
    const contentLength = response.headers.get('Content-Length') || response.headers.get('content-length')
    const chunkSize = Math.ceil(contentLength / this.threads)
    const numChunks = Math.ceil(contentLength / chunkSize)

    // Build range requests
    let promises = []
    for (let i = 0; i < numChunks; i++) {
      const headers = new Headers()
      headers.append('Range', `bytes=${i * chunkSize}-${(i * chunkSize) + chunkSize - 1}`)

      promises.push(
        this.fetchRetry(this.url, {
          headers: headers,
          method: 'GET',
          mode: 'cors',
          signal: this.controller.signal
        })
          .then(response => this.respondWithProgressMonitor({chunk: i + 1}, response))
      )
    }

    const headers = new Headers(response.headers)
    headers.append('Content-Disposition', `attachment; filename="${this.fileName}"`)

    // Map respones to arrayBuffers, reduce to single arrayBuffer for final response
    return Promise.all(promises)
      .then(responses => Promise.all(responses.map(res => res.arrayBuffer())))
      .then(buffers => new Response(buffers.reduce(this.concatArrayBuffer, new Uint8Array()), {headers: headers}))
  }


  fetchRetry (url, init) {
    const retries = this.retries
    const retryDelay = this.retryDelay
    const retryOn = this.retryOn || []
    return new Promise(function (resolve, reject) {
      function fetchAttempt (retriesRemaining) {
        fetch(url, init)
          .then(function (response) {
            if (retryOn.indexOf(response.status) === -1) {
              resolve(response)
            } else {
              if (retriesRemaining > 0) {
                retry(retriesRemaining)
              } else {
                reject(response)
              }
            }
          })
          .catch(function (error) {
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
  concatArrayBuffer (ab1, ab2) {
    const tmp = new Uint8Array(ab1.byteLength + ab2.byteLength)
    tmp.set(new Uint8Array(ab1), 0)
    tmp.set(new Uint8Array(ab2), ab1.byteLength)
    return tmp.buffer
  }

  progress ({loaded, total, chunk, url, els}) {
    // if (!this.progressElements[url + chunk]) {
    if (!els[url + chunk]) {
      let el = document.createElement('progress')
      el.classList.add('progressBar')
      els[url + chunk] = el
      document.getElementById('progressArea').appendChild(el)
    }
    els[url + chunk].value = loaded / total
  }

  respondWithProgressMonitor (options, response) {
    const contentLength = response.headers.get('content-length')
    const total = parseInt(contentLength, 10)
    const reader = response.body.getReader()
    const progress = this.progress
    const els = this.progressElements
    let loaded = 0

    return new Response(
      new ReadableStream({
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
              progress({loaded, total, chunk: options.chunk, url: response.url, els})
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
      })
    )
  }

  // createWriteStream (fileName, queuingStrategy, fileSize) {
  //   // normalize arguments
  //   if (Number.isFinite(queuingStrategy)) {
  //     [fileSize, queuingStrategy] = [queuingStrategy, fileSize]
  //   }
  //
  //   this.fileName = fileName
  //   this.fileSize = fileSize
  //   this.queuingStrategy = queuingStrategy
  //
  //   return new window.WritableStream({
  //     start (controller) {
  //       // is called immediately, and should perform any actions necessary to
  //       // acquire access to the underlying sink. If the process is asynchronous,
  //       // it can return a promise to signal success or failure.
  //       // return setupMessageChannel()
  //     },
  //     write (chunk) {
  //       // is called when a new chunk of data is ready to be written to the
  //       // underlying sink. It can return a promise to signal success or failure
  //       // of the write operation. The stream implementation guarantees that
  //       // this method will be called only after previous writes have succeeded,
  //       // and never after close or abort is called.
  //
  //       // TODO: Kind of important that service worker respond back when it has
  //       // been written. Otherwise we can't handle backpressure
  //       // messageChannel.port1.postMessage(chunk)
  //     },
  //     close () {
  //       // messageChannel.port1.postMessage('end')
  //       console.log('All data successfully written!')
  //     },
  //     abort () {
  //       // messageChannel.port1.postMessage('abort')
  //     }
  //   }, queuingStrategy)
  // }
}
