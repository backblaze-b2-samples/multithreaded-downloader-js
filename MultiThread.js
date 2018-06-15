class MultiThread {
  constructor (options) {
    if (!window.ReadableStream && !window.WritableStream) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onStart = this.onStart.bind(this) || function () {}
    this.onFinish = this.onFinish.bind(this) || function () {}
    this.onProgress = this.onProgress.bind(this) || function () {}
    this.headers = new Headers(this.headers)
    this.controller = new AbortController()
    this.url = new URL(this.url)
    this.refreshTime = 1000
    this.writing = false
    this.written = 0
    this.loaded = 0
    this.queue = []

    util.fetchRetry(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.headers,
      signal: this.controller.signal
    }).then(response => {
      this.contentLength = util.getContentLength(response)
      this.writer = streamSaver.createWriteStream(this.fileName, this.contentLength).getWriter()
      this.chunks = {
        total: Math.ceil(this.contentLength / this.chunkSize),
        started: 0,
        finished: 0
      }

      this.onStart({contentLength: this.contentLength, chunks: this.chunks.total})
      this.fetchChunk()
      this.writeNextChunk()

      for (let i = 1; i < this.threads; i++) {
        this.tryFetch()
      }
    })

    return this
  }

  tryFetch () {
    if (this.queue.length < this.threads) {
      this.fetchChunk()
    } else {
      // console.log('waiting for slot in queue')
      setTimeout(this.tryFetch.bind(this), this.refreshTime)
    }
  }

  fetchChunk () {
    if (this.chunks.started < this.chunks.total) {
      const startByte = this.chunks.started * this.chunkSize
      const endByte = startByte + this.chunkSize - 1
      const id = this.chunks.started++

      let chunk = new Chunk({
        id: id,
        url: this.url,
        endByte: endByte,
        startByte: startByte,
        headers: this.headers,
        controller: this.controller,
        onStart: this.onChunkStart,
        onFinish: this.onChunkFinish,
        onProgress: ({id, contentLength, loaded, byteLength}) => {
          this.loaded += byteLength
          this.onProgress({contentLength: this.contentLength, finished: this.chunks.finished, loaded: this.loaded})
          this.onChunkProgress({contentLength: contentLength, loaded: loaded, id: id})
        }
      })

      this.queue.push(chunk)

      return chunk.start()
    }

    // No chunks left
    return null
  }

  writeNextChunk () {
    let chunk = this.queue.find(item => item.id === this.chunks.finished)

    if (chunk) {
      // Move chunk from queue to this.currentChunk
      this.queue = this.queue.filter(item => item.id !== chunk.id)
      this.currentChunk = chunk
      this.writeStream()
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
      this.currentChunk.reader = this.currentChunk.response.body.getReader()
      this.writing = true

      const pump = () => {
        this.currentChunk.reader.read().then(({done, value}) => {
          this.currentChunk.doneWriting = done

          if (!done) {
            this.currentChunk.written += value.byteLength
            this.written += value.byteLength
            this.writer.write(value)
            pump()
          } else {
            this.writing = false
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
      }

      pump()
    }
  }

  retryRangeById (id) {
    const chunk = this.queue.find(item => item.id === this.chunks.finished)
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
