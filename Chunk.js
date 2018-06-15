class Chunk {
  constructor (options) {
    Object.assign(this, options)
    this.onStart = this.onStart.bind(this) || function () {}
    this.onFinish = this.onFinish.bind(this) || function () {}
    this.onProgress = this.onProgress.bind(this) || function () {}

    // Passthrough this.headers to each range request (for Google Drive auth)
    this.headers = new Headers(this.headers)
    this.headers.set('Range', `bytes=${this.startByte}-${this.endByte}`)
    this.url = new URL(this.url)
    this.doneLoading = false
    this.doneWriting = false
    this.loaded = 0
    this.written = 0
  }

  start () {
    return util.fetchRetry(this.url, {
      headers: this.headers,
      method: 'GET',
      mode: 'cors',
      signal: this.controller.signal
    }).then(response => {
      this.response = response
      this.contentLength = util.getContentLength(response)
      this.onStart({contentLength: this.contentLength, id: this.id})
      this.monitor()

      return this
    })
  }

  monitor () {
    // Clone the response so the original won't be locked to a reader
    this.monitorReader = this.response.clone().body.getReader()

    const pump = () => {
      this.monitorReader.read().then(({done, value}) => {
        this.doneLoading = done

        if (!done) {
          this.loaded += value.byteLength
          this.onProgress({contentLength: this.contentLength, byteLength: value.byteLength, loaded: this.loaded, id: this.id})
          pump()
        } else {
          this.onFinish({contentLength: this.contentLength, id: this.id})
        }
      }).catch(error => {
        if (!this.doneLoading) {
          console.error(error)
          this.retry()
        }
      })
    }

    pump()
  }

  retry () {
    if (this.monitorReader) {
      this.monitorReader.releaseLock()
      this.monitorReader.cancel()
    }

    if (this.reader) {
      this.reader.releaseLock()
      this.reader.cancel()
    }

    if (this.response.body) {
      this.response.body.cancel()
    }

    this.startByte = this.startByte + this.loaded
    this.headers.set('Range', `bytes=${this.startByte}-${this.endByte}`)
    this.start()
  }
}
