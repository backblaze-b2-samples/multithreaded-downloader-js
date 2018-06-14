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
    this.currentChunk = null
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
      this.chunks = {
        total: Math.ceil(this.contentLength / this.chunkSize),
        started: 0,
        finished: 0
      }

      const fileStream = streamSaver.createWriteStream(this.fileName, this.contentLength)
      this.writer = fileStream.getWriter()
      this.writer.writing = false

      this.onStart({totalChunks: this.chunks.total, contentLength: this.contentLength})

      this.fetchChunk()
      this.writeNextChunk()
      for (let i = 1; i < this.threads; i++) {
        this.tryFetch()
      }
    })
  }

  fetchChunk () {
    if (this.chunks.started < this.chunks.total) {
      const start = this.chunks.started * this.chunkSize
      const end = start + this.chunkSize - 1
      const id = this.chunks.started++

      let chunk = new Chunk({
        id: id,
        end: end,
        start: start,
        headers: this.headers,
        onStart: this.onChunkStart,
        onProgress: this.onChunkProgress,
        onFinish: this.onChunkFinish
      })

      this.downloadQueue.push(chunk)

      return chunk.fetch(this.url, {
        headers: this.requestHeaders,
        controller: this.controller
      })
    }

    // No chunks left
    return null
  }

  tryFetch () {
    if (this.downloadQueue.length < this.threads) {
      this.fetchChunk()
    } else {
      console.log('waiting for slot in queue')
      setTimeout(this.tryFetch.bind(this), this.refreshTime)
    }
  }

  writeNextChunk () {
    let chunk = this.downloadQueue.find(item => item.id === this.chunks.finished)

    if (chunk) {
      // Move chunk from downloadQueue to this.currentChunk
      this.downloadQueue = this.downloadQueue.filter(item => item.id !== chunk.id)
      this.currentChunk = chunk
      this.writeStream()
    } else if (this.chunks.total === this.chunks.finished) {
      console.log('finished')
    } else {
      // console.warn('borked')
      this.tryFetch()
      return setTimeout(this.writeNextChunk.bind(this), this.refreshTime)
    }
  }

  writeStream () {
    if (!this.currentChunk || !this.currentChunk.response) {
      // Response not ready yet
      return setTimeout(this.writeStream.bind(this), this.refreshTime)
    }

    if (!this.currentChunk.response.body.locked) {
      this.writer.writing = true
      this.currentChunk.reader = this.currentChunk.response.body.getReader()

      const pump = () => this.currentChunk.reader.read().then(({done, value}) => {
        this.currentChunk.doneWriting = done
        if (!this.currentChunk.doneWriting) {
          this.currentChunk.bytesWritten += value.byteLength
          this.bytesWritten += value.byteLength
          this.writer.write(value)
          this.onProgress({contentLength: this.contentLength, loaded: this.bytesWritten})
          pump()
        } else {
          this.writer.writing = false
          this.chunks.finished++
          if (this.chunks.finished < this.chunks.total) {
            this.writeNextChunk()
            this.tryFetch()
          } else {
            this.writer.close()
            this.onFinish()
          }
        }
      }).catch(error => {
        if (!this.currentChunk.doneWriting) {
          console.error(`Chunk #${this.currentChunk.id} failed: `, error)
          this.currentChunk.retry()
        }
      })

      // Start reading
      pump()
    } else {
      console.log(this.currentChunk)
    }
  }

  retryRangeById (id) {
    const chunk = this.writeQueue.find(item => item.id === this.chunks.finished) || this.downloadQueue.find(item => item.id === this.chunks.finished)
    chunk.retry()
  }

  cancel () {
    this.controller.abort()
    if (this.writer) {
      this.writer.close()
    }

    return Promise.resolve()
  }
}
