class MultiThread {
  constructor (options = {onStart: () => {}, onProgress: () => {}, onFinish: () => {}}) {
    if (!window.ReadableStream && !window.WritableStream) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onStart = this.onStart.bind(this)
    this.onFinish = this.onFinish.bind(this)
    this.onProgress = this.onProgress.bind(this)
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

    try {
      return this.fetchRetry(this.url, {
        method: 'HEAD',
        mode: 'cors',
        headers: init.headers,
        signal: this.controller.signal
      }).then(response => {
        this.queue = []
        this.requestDelay = 250
        this.rangesStarted = 0
        this.rangesFinished = 0
        this.rangeSize *= 1048576 // Convert mb -> bytes
        this.contentLength = this.getContentLength(response)
        this.totalRanges = Math.ceil(this.contentLength / this.rangeSize)
        this.fileStream = streamSaver.createWriteStream(this.fileName, this.contentLength)
        this.writer = this.fileStream.getWriter()

        this.onStart({rangeCount: this.totalRanges, contentLength: this.contentLength})

        // Start the first range then begin writing to output
        this.fetchRange().then(this.transferRange.bind(this))
        for (let i = 1; i < this.threads; i++) {
          setTimeout(this.fetchRange.bind(this), this.requestDelay * i)
        }
      })
    } catch (error) {
      console.error('gotit', error)
    }
  }

  fetchRange () {
    if (this.rangesStarted < this.totalRanges) {
      // Passthrough this.headers to each range request (for GDrive auth)
      const headers = new Headers(this.headers)
      const start = this.rangesStarted * this.rangeSize
      const end = start + this.rangeSize - 1
      headers.set('Range', `bytes=${start}-${end}`)

      let range = {id: this.rangesStarted, loaded: 0, headers, start, end}
      this.rangesStarted++

      return this.fetchRetry(this.url, {
        headers: range.headers,
        method: 'GET',
        mode: 'cors',
        signal: this.controller.signal
      }).then(response => {
        range.response = response.clone()
        range.contentLength = this.getContentLength(response)
        range.onFinish = range => {
          this.tryFetch()
        }

        this.queue.push(range)
        return range
      }).then(this.monitorStream.bind(this))
    }

    // All ranges accounted for
    return null
  }

  tryFetch () {
    if (this.queue.length < this.threads) {
      this.fetchRange()
    } else {
      setTimeout(() => {
        this.tryFetch()
      }, this.requestDelay)
    }
  }

  monitorStream (range) {
    // Clone the response so the original won't be locked to a reader
    const cloned = range.response.clone()
    const reader = cloned.body.getReader()

    const pump = () => {
      reader.read().then(({done, value}) => {
        range.done = done
        if (!range.done) {
          range.loaded += value.byteLength
          this.onProgress({id: range.id, contentLength: range.contentLength, loaded: range.loaded})
          pump()
        } else {
          range.onFinish(range)
        }
      })
    }

    reader.closed.then(() => {
      if (!range.done) {
        range.stalled = true
        console.error(`Range #${range.id} stalled! Retrying...`)

        this.fetchRetry(this.url, {
          headers: range.headers,
          method: 'GET',
          mode: 'cors',
          signal: this.controller.signal
        }).then(response => {
          range.response = response
          range.contentLength = this.getContentLength(response)
          return range
        }).then(this.monitorStream.bind(this))
      }
    })

    // Start reading
    pump()

    return range
  }

  transferRange (range) {
    if (range && !range.response.body.locked) {
      const reader = range.response.body.getReader()
      const pump = () => reader.read().then(({done, value}) => {
        if (!done) {
          this.writer.write(value)
          pump()
        } else {
          // Remove the range from the queue when it's done writing
          this.queue.shift()
          this.rangesFinished++
          if (this.queue.length > 0) {
            this.transferRange(this.queue[0])
          } else if (this.rangesFinished === this.totalRanges) {
            this.writer.close()
            this.onFinish()
          } else {
            // Nothing in queue, try again later
            setTimeout(() => {
              this.transferRange(this.queue[0])
            }, this.requestDelay)
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
