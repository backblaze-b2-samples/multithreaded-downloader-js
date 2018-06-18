class MultiThread {
  constructor (options) {
    if (!window.ReadableStream && !window.WritableStream) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onStart = this.onStart.bind(this) || function () {}
    this.onFinish = this.onFinish.bind(this) || function () {}
    this.onProgress = this.onProgress.bind(this) || function () {}
    this.onError = this.onError.bind(this) || function () {}

    this.headers = new Headers(this.headers)
    this.controller = new AbortController()
    this.url = new URL(this.url)
    this.writer = streamSaver.createWriteStream(this.fileName).getWriter()
    this.writing = false
    this.written = 0
    this.refreshTime = 1000
    this.loaded = 0
    this.queue = []

    util.fetchRetry(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.headers,
      signal: this.controller.signal
    }).then(response => {
      this.contentLength = util.getContentLength(response)
      this.chunks = {
        total: Math.ceil(this.contentLength / this.chunkSize),
        started: 0,
        finished: 0
      }

      this.onStart({contentLength: this.contentLength, chunks: this.chunks.total})

      this.nextChunk()
      this.writeNextChunk()
      for (let i = 1; i < this.threads; i++) {
        this.nextChunk()
      }
    })

    return this
  }

  nextChunk () {
    if (this.chunks.started < this.chunks.total) {
      const startByte = this.chunks.started * this.chunkSize
      const endByte = startByte + this.chunkSize - 1
      const id = this.chunks.started++
      const chunk = new Chunk({
        id: id,
        url: this.url,
        endByte: endByte,
        startByte: startByte,
        headers: this.headers,
        controller: this.controller,
        onStart: this.onChunkStart,
        onFinish: this.onChunkFinish,
        onError: this.onChunkError,
        onProgress: ({id, contentLength, loaded, byteLength}) => {
          this.loaded += byteLength
          this.onChunkProgress({contentLength: contentLength, loaded: loaded, id: id})
          this.onProgress({contentLength: this.contentLength, started: this.chunks.started, loaded: this.loaded})
        }
      })

      this.queue.push(chunk)

      return chunk.start()
    }

    // No chunks left
    return null
  }

  // Wait for an open slot in queue then get the next chunk.
  checkQueue () {
    if (this.queue.length < this.threads) {
      this.nextChunk()
    } else {
      setTimeout(this.checkQueue.bind(this), this.refreshTime)
    }
  }

  writeNextChunk () {
    let chunk = this.queue.find(item => item.id === this.chunks.finished)

    if (chunk) {
      this.queue = this.queue.filter(item => item.id !== chunk.id)
      this.currentChunk = chunk
      this.writeStream()
    } else {
      this.checkQueue()
      setTimeout(this.writeNextChunk.bind(this), this.refreshTime)
    }
  }

  writeStream () {
    if (!this.currentChunk || !this.currentChunk.response) {
      // Response not ready yet
      return setTimeout(this.writeStream.bind(this), this.refreshTime)
    }

    if (!this.currentChunk.response.body.locked) {
      this.currentChunk.reader = this.currentChunk.response.body.getReader()
      this.writing = true

      const pump = () => {
        this.currentChunk.reader.read().then(({done, value}) => {
          this.currentChunk.doneWriting = done

          if (!done) {
            this.currentChunk.written += value.byteLength
            this.written += value.byteLength
            this.writer.write(value)

            if (!this.currentChunk.retryRequested) {
              pump()
            } else {
              this.currentChunk.reader.releaseLock()
              setTimeout(this.writeStream.bind(this), this.refreshTime)
            }
          } else {
            this.writing = false
            this.chunks.finished++

            if (this.chunks.finished < this.chunks.total) {
              this.writeNextChunk()
              this.checkQueue()
            } else {
              this.writer.close()
              this.onFinish({contentLength: this.contentLength})
            }
          }
        }).catch(error => {
          if (!this.currentChunk.doneWriting) {
            this.onError({error: error})
            this.currentChunk.retry()
            setTimeout(this.writeStream.bind(this), this.refreshTime)
          }
        })
      }

      pump()
    }
  }

  retryRangeById (id) {
    let chunk = this.queue.find(item => item.id === id)

    if (!chunk && this.currentChunk.id === id) {
      chunk = this.currentChunk
    }

    if (chunk) {
      chunk.retry()
    }
  }

  cancel () {
    this.controller.abort()
    if (this.writer) {
      this.writer.close()
    }

    return Promise.resolve()
  }
}
