class MultiThread {
  constructor (options = {}, onProgress = () => {}, onFinish = () => {}) {
    if (!this.supported()) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onFinish = onFinish.bind(this)
    this.onProgress = onProgress.bind(this)
  }

  supported () {
    try {
      return !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (error) {
      return false
    }
  }

  cancel () {
    this.controller.abort()
    if (this.writer) {
      this.writer.close()
    }
    return Promise.resolve()
  }

  fetch (url, init = {}) {
    this.url = new URL(url)
    this.controller = new AbortController()

    return this.fetchRetry(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: init.headers,
      signal: this.controller.signal
    }).then(response => {
      this.pending = []
      this.rangeCount = 0
      this.rangeSize *= 1048576 // Convert mb -> bytes
      this.contentLength = this.getContentLength(response)
      this.totalRanges = Math.ceil(this.contentLength / this.rangeSize)
      this.fileStream = streamSaver.createWriteStream(this.fileName, this.contentLength)
      this.writer = this.fileStream.getWriter()

      // Start the first range then begin writing to output
      this.fetchRange().then(this.transferPending.bind(this))
    })
  }

  fetchRange () {
    if (this.rangeCount < this.totalRanges) {
      // Passthrough this.headers to each range request (for GDrive auth)
      const headers = new Headers(this.headers)
      const start = this.rangeCount * this.rangeSize
      const end = start + this.rangeSize - 1
      headers.set('Range', `bytes=${start}-${end}`)

      let range = {
        id: this.rangeCount,
        headers: headers,
        loaded: 0
      }
      this.rangeCount++

      return this.fetchRetry(this.url, {
        headers: range.headers,
        method: 'GET',
        mode: 'cors',
        signal: this.controller.signal
      }).then(response => {
        range.response = response.clone()
        range.contentLength = this.getContentLength(response)
        return range
      }).then(this.addToPending.bind(this))
        .then(this.monitorProgress.bind(this))
    }

    // All ranges accounted for
    return null
  }

  addToPending (range) {
    this.pending.push(range)

    if (this.pending.length < this.threads) {
      this.fetchRange()
    }

    return range
  }

  monitorProgress (range) {
    // Clone the response so the original won't be locked to a reader
    const cloned = range.response.clone()
    const reader = cloned.body.getReader()

    const pump = () => reader.read().then(({done, value}) => {
      range.done = done
      if (!done) {
        range.loaded += value.byteLength
        this.onProgress({id: range.id, contentLength: range.contentLength, loaded: range.loaded})
        pump()
      }
    })

    reader.closed.then(() => {
      if (!range.done) {
        console.error(`Range #${range.id} failed! Retrying...`)

        this.fetchRetry(this.url, {
          headers: range.headers,
          method: 'GET',
          mode: 'cors',
          signal: this.controller.signal
        }).then(response => {
          range.response = response
          range.contentLength = this.getContentLength(response)
          return range
        }).then(this.monitorProgress.bind(this))
      }
    })

    // Start reading
    pump()
  }

  transferPending () {
    const range = this.pending[0]
    if (range && !range.response.body.locked) {
      const reader = range.response.body.getReader()
      const pump = () => reader.read().then(({done, value}) => {
        if (!done) {
          this.writer.write(value)
          pump()
        } else {
          this.pending.shift()
          if (this.pending.length > 0) {
            this.transferPending()
            this.fetchRange() || this.transferPending()
          } else if (this.rangeCount < this.totalRanges) {
            this.fetchRange() || this.transferPending()
          } else {
            this.writer.close()
            this.onFinish()
          }
        }
      })

      // Start reading
      pump()
    }
  }

  getContentLength (response) {
    // Google drive response headers are all lower case, B2's are not!
    return parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))
  }

  fetchRetry (url, init) {
    const {retries, retryDelay, retryOn} = this

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
          if (retryOn.indexOf(404) !== -1) {
            if (retriesRemaining > 0) {
              retry(retriesRemaining)
            } else {
              reject(error)
            }
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
