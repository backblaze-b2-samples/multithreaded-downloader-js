class Range {
  constructor (options = {onStart: () => {}, onProgress: () => {}, onFinish: () => {}}) {
    Object.assign(this, options)

    // Passthrough this.headers to each range request (for GDrive auth)
    this.headers = new Headers(this.headers)
    this.headers.set('Range', `bytes=${this.start}-${this.end}`)
    this.doneReading = false
    this.doneWriting = false
    this.bytesLoaded = 0
    this.bytesWritten = 0
  }

  fetch (url, init) {
    this.url = new URL(url)
    this.controller = init.controller

    return util.fetchRetry(this.url, {
      headers: this.headers,
      method: 'GET',
      mode: 'cors',
      signal: this.controller.signal
    }).then(response => {
      this.response = response.clone()
      this.contentLength = util.getContentLength(response)
      this.monitor()
      this.onStart({id: this.id, contentLength: this.contentLength})
      return this
    })
  }

  monitor () {
    // Clone the response so the original won't be locked to a reader
    this.monitorReader = this.response.clone().body.getReader()

    const pump = () => {
      this.monitorReader.read().then(({done, value}) => {
        this.doneReading = done
        if (!this.doneReading) {
          this.bytesLoaded += value.byteLength
          this.onProgress({id: this.id, contentLength: this.contentLength, loaded: this.bytesLoaded})
          pump()
        } else {
          this.onFinish({id: this.id, contentLength: this.contentLength})
        }
      }).catch(error => {
        if (!this.doneReading) {
          console.error(error)
          this.retry()
        }
      })
    }

    // Start reading
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

    // if (this.response.body) {
    //   this.response.body.cancel()
    // }

    this.start = this.start + this.bytesLoaded
    this.headers.set('Range', `bytes=${this.start}-${this.end}`)

    return this.fetch(this.url, {controller: this.controller})
  }
}
