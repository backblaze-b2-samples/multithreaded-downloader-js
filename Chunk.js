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
    this.retryRequested = false
    this.done = false
    this.written = 0
  }

  start () {
    this.onStart({id: this.id})

    return window.fetch(this.url, {
      mode: 'cors',
      method: 'GET',
      headers: this.headers,
      signal: this.controller.signal
    })
      .then(response => {
        this.response = response
        this.retryRequested = false
        this.contentLength = parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))
        this.loaded = 0
        this.monitor()

        return response
      })
  }

  monitor () {
    // Clone the response so the original won't be locked to a reader
    this.monitorReader = this.response.clone().body.getReader()

    const pump = () => {
      this.monitorReader.read()
        .then(({done, value}) => {
          this.done = done
          if (!done) {
            if (this.retryRequested) {
              this.monitorReader.releaseLock()
              this.onProgress({
                id: this.id,
                loaded: -this.loaded,
                byteLength: -this.loaded,
                contentLength: this.contentLength
              })
              this.start()
            } else {
              this.loaded += value.byteLength
              this.onProgress({
                id: this.id,
                loaded: this.loaded,
                byteLength: value.byteLength,
                contentLength: this.contentLength
              })
              pump()
            }
          } else {
            this.monitorReader.releaseLock()
            this.onFinish({id: this.id})
          }
        })
        .catch(error => {
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
    // this.onProgress({
    //   id: this.id,
    //   loaded: -this.loaded,
    //   byteLength: -this.loaded,
    //   contentLength: this.contentLength
    // })
    // this.start()
  }
}

// module.exports = Chunk
