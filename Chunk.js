class Chunk {
  constructor (options) {
    Object.assign(this, options)
    this.onStart = this.onStart ? this.onStart.bind(this) : () => {}
    this.onFinish = this.onFinish ? this.onFinish.bind(this) : () => {}
    this.onProgress = this.onProgress ? this.onProgress.bind(this) : () => {}
    this.onError = this.onError ? this.onError.bind(this) : () => {}

    // Passthrough this.headers to each range request (for Google Drive auth)
    this.headers = new Headers(this.headers)
    this.headers.set('Range', `bytes=${this.startByte}-${this.endByte}`)
    this.url = new URL(this.url)
    this.done = false
    this.loaded = 0
    this.written = 0
  }

  start () {
    this.onStart({id: this.id})

    return fetch(this.url, {
      headers: this.headers,
      method: 'GET',
      mode: 'cors',
      signal: this.controller.signal
    }).then(response => {
      this.response = response
      this.retryRequested = false
      this.contentLength = util.getContentLength(response)
      this.monitor()
      return response.blob()
    })
  }

  monitor () {
    // Clone the response so the original won't be locked to a reader
    this.monitorReader = this.response.clone().body.getReader()

    const pump = () => {
      this.monitorReader.read().then(({done, value}) => {
        this.done = done

        if (!done) {
          this.loaded += value.byteLength
          this.onProgress({id: this.id, contentLength: this.contentLength, loaded: this.loaded, byteLength: value.byteLength})

          if (this.retryRequested) {
            this.monitorReader.releaseLock()
          } else {
            pump()
          }
        } else {
          this.onFinish({id: this.id})
        }
      }).catch(error => {
        this.onError({error: error, id: this.id})

        if (!this.done) {
          this.retry()
        }
      })
    }

    pump()
  }

  retry () {
    this.retryRequested = true
    // this.headers.set('Range', `bytes=${this.startByte + this.loaded}-${this.endByte}`)
    this.start()
  }
}
