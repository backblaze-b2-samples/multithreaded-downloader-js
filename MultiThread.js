class MultiThread {
  constructor (options) {
    if (!window.ReadableStream && !window.WritableStream) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onStart = this.onStart.bind(this) || function () {}
    this.onFinish = this.onFinish.bind(this) || function () {}
    this.onProgress = this.onProgress.bind(this) || function () {}
    this.controller = new AbortController()
    this.refreshTime = 1000
    this.downloadQueue = []
    this.currentRange = null
  }

  fetch (url, init) {
    this.url = new URL(url)
    this.requestHeaders = new Headers(init.headers)

    return util.fetchRetry(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.requestHeaders,
      signal: this.controller.signal
    }).then(response => {
      this.contentLength = util.getContentLength(response)
      this.bytesWritten = 0
      this.ranges = {
        total: Math.ceil(this.contentLength / this.rangeSize),
        started: 0,
        finished: 0
      }

      const fileStream = streamSaver.createWriteStream(this.fileName, this.contentLength)
      this.writer = fileStream.getWriter()
      this.writer.writing = false

      this.onStart({rangesTotal: this.ranges.total, contentLength: this.contentLength})

      this.fetchRange()
      this.writeNextRange()
      for (let i = 1; i < this.threads; i++) {
        this.tryFetch()
      }
    })
  }

  fetchRange () {
    if (this.ranges.started < this.ranges.total) {
      const start = this.ranges.started * this.rangeSize
      const end = start + this.rangeSize - 1
      const id = this.ranges.started++

      let range = new Range({
        id: id,
        end: end,
        start: start,
        headers: this.headers,
        onStart: this.onRangeStart,
        onProgress: this.onRangeProgress,
        onFinish: this.onRangeFinish
      })

      this.downloadQueue.push(range)

      return range.fetch(this.url, {
        headers: this.requestHeaders,
        controller: this.controller
      })
    }

    // No ranges left
    return null
  }

  tryFetch () {
    if (this.downloadQueue.length < this.threads) {
      this.fetchRange()
    } else {
      console.log('waiting for slot in queue')
      setTimeout(this.tryFetch.bind(this), this.refreshTime)
    }
  }

  writeNextRange () {
    let range = this.downloadQueue.find(item => item.id === this.ranges.finished)

    if (range) {
      // Move range from downloadQueue to this.currentRange
      this.downloadQueue = this.downloadQueue.filter(item => item.id !== range.id)
      this.currentRange = range
      this.writeStream()
    } else if (this.ranges.total === this.ranges.finished) {
      console.log('finished')
    } else {
      console.warn('borked')
      this.tryFetch()
      return setTimeout(this.writeNextRange.bind(this), this.refreshTime)
    }
  }

  writeStream () {
    if (!this.currentRange || !this.currentRange.response) {
      // Response not ready yet
      return setTimeout(this.writeStream.bind(this), this.refreshTime)
    }

    if (!this.currentRange.response.body.locked) {
      this.writer.writing = true
      this.currentRange.reader = this.currentRange.response.body.getReader()

      const pump = () => this.currentRange.reader.read().then(({done, value}) => {
        this.currentRange.doneWriting = done
        if (!this.currentRange.doneWriting) {
          this.currentRange.bytesWritten += value.byteLength
          this.bytesWritten += value.byteLength
          this.writer.write(value)
          this.onProgress({contentLength: this.contentLength, loaded: this.bytesWritten})
          pump()
        } else {
          this.writer.writing = false
          this.ranges.finished++
          if (this.ranges.finished < this.ranges.total) {
            this.writeNextRange()
            this.tryFetch()
          } else {
            this.writer.close()
            this.onFinish()
          }
        }
      }).catch(error => {
        if (!this.currentRange.doneWriting) {
          console.error(`Range #${this.currentRange.id} failed: `, error)
          this.currentRange.retry()
        }
      })

      // Start reading
      pump()
    } else {
      console.log(this.currentRange)
    }
  }

  retryRangeById (id) {
    const range = this.writeQueue.find(item => item.id === this.ranges.finished) || this.downloadQueue.find(item => item.id === this.ranges.finished)
    range.retry()
  }

  cancel () {
    this.controller.abort()
    if (this.writer) {
      this.writer.close()
    }

    return Promise.resolve()
  }
}
