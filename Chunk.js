class Chunk {
  constructor (options) {
    Object.assign(this, options)
    this.onStart = this.onStart.bind(this) || function () {}
    this.onFinish = this.onFinish.bind(this) || function () {}
    this.onProgress = this.onProgress.bind(this) || function () {}
    this.onError = this.onError.bind(this) || function () {}

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
    this.onStart({id: this.id})

    return util.fetchRetry(this.url, {
      headers: this.headers,
      method: 'GET',
      mode: 'cors',
      signal: this.controller.signal
    }).then(response => {
      this.response = response
      this.retryRequested = false
      this.contentLength = util.getContentLength(response)
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

          if (!this.retryRequested) {
            pump()
          } else {
            this.monitorReader.releaseLock()
          }
        } else {
          this.onFinish({contentLength: this.contentLength, id: this.id})
        }
      }).catch(error => {
        if (!this.doneLoading) {
          this.onError({error: error, id: this.id})
          this.retry()
        }
      })
    }

    pump()
  }

  retry () {
    this.retryRequested = true
    // this.startByte = this.startByte + this.loaded
    this.headers.set('Range', `bytes=${this.startByte + this.loaded}-${this.endByte}`)
    this.start()
  }
}
