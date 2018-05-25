class MultiThreadedDownloader {
  constructor (url, options) {
    if (!this.supported()) {
      console.error('Web Streams are not supported!')
      return
    }

    Object.assign(this, options)

    this.url = url
    this.pathname = this.url.pathname.split('/')
    this.fileName = this.fileName || this.pathname[this.pathname.length - 1]
    this.promises = []

    // "Access-Control-Expose-Headers: Content-Length" must be enabled for HEAD requests!
    return this.fetchRetry(url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.headers,
      signal: this.controller.signal
    }).then(this.buildRangeRequests.bind(this))
      .then(response => response.blob())
      .then(blob => {
        // The download attribute requires "Content-Disposition" HTTP header
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

  // Returns a promise that fulfils into a new Response object
  buildRangeRequests (response) {
    // Google drive response headers are all lower case, B2's are not!
    const contentLength = parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))

    if (this.reqType === 'chunkSize') {
      this.chunkSize *= 1048576 // Convert mb -> bytes
      this.numChunks = Math.ceil(contentLength / this.chunkSize)
    } else {
      this.chunkSize = Math.ceil(contentLength / this.threads)
      this.numChunks = this.threads
    }

    // Build range requests
    const headers = this.headers || new Headers()
    for (let chunkCount = 0; chunkCount < this.numChunks; chunkCount++) {
      headers.set('Range', `bytes=${chunkCount * this.chunkSize}-${(chunkCount * this.chunkSize) + this.chunkSize - 1}`)
      this.promises.push(this.fetchRetry(this.url, {
        headers: headers,
        method: 'GET',
        mode: 'cors',
        signal: this.controller.signal
      }))
    }

    // Add 'Content-Disposition' to the original respone headers
    const responseHeaders = new Headers(response.headers)
    responseHeaders.append('Content-Disposition', `attachment; filename="${this.fileName}"`)

    // Map respones to arrayBuffers, reduce to single arrayBuffer for final response
    return Promise.all(this.promises)
      .then(responses => Promise.all(responses.map(response => response.arrayBuffer())))
      .then(buffers => new Response(buffers.reduce(this.concatTypedArray, new Uint8Array()), {responseHeaders}))
  }

  concatTypedArray (array1, array2) {
    const temp = new Uint8Array(array1.byteLength + array2.byteLength)
    temp.set(new Uint8Array(array1), 0)
    temp.set(new Uint8Array(array2), array1.byteLength)
    return temp.buffer
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
}
