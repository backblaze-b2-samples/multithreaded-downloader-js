class MultiThread {
  constructor (options) {
    if (!window.ReadableStream && !window.WritableStream) {
      throw Error('Web Streams are not yet supported in this browser.')
    }

    Object.assign(this, options)
    this.onStart = this.onStart ? this.onStart.bind(this) : () => {}
    this.onFinish = this.onFinish ? this.onFinish.bind(this) : () => {}
    this.onProgress = this.onProgress ? this.onProgress.bind(this) : () => {}
    this.onError = this.onError ? this.onError.bind(this) : () => {}

    this.url = new URL(this.url)
    this.headers = new Headers(this.headers)
    this.controller = new AbortController()
    this.queue = new PromiseQueue({
      concurrency: this.threads,
      onFinish: () => {
        this.concatChunks()
        this.onFinish()
      }
    })

    fetch(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.headers,
      signal: this.controller.signal
    }).then(response => {
      this.contentLength = util.getContentLength(response)
      this.chunkTotal = Math.ceil(this.contentLength / this.chunkSize)
      this.onStart({contentLength: this.contentLength, chunks: this.chunkTotal})
      this.loaded = 0

      this.fileSystem = new FileSystem()

      this.fileSystem.getRoot()
        .then(dir => dir.readEntries())
        .then(entries => {
          console.log(entries)
          entries.forEach(entry => entry.remove())
        })

      this.fileSystem.allocate(this.contentLength)
      this.fileSystem.getStatistics().then(stats => {
        console.log(this.contentLength, stats)
      })

      for (let i = 0; i < this.chunkTotal; i++) {
        const startByte = i * this.chunkSize
        const endByte = startByte + this.chunkSize - 1
        const chunk = new Chunk({
          id: i,
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
            this.onProgress({contentLength: this.contentLength, loaded: this.loaded})
            this.onChunkProgress({contentLength: contentLength, loaded: loaded, id: id})
          }
        })

        this.queue.add(() => {
          return new Promise((resolve, reject) => {
            chunk.start().then(blob => {
              this.fileSystem.getRoot()
                .then(dir => dir.makeFileEntry(`${startByte}-${endByte}`))
                .then(file => file.write(blob))
                .then(resolve)
            }).catch(error => {
              reject(error)
            })
          })
        }, {attempts: this.retries})
      }
    })

    return this
  }

  concatChunks () {
    this.writer = streamSaver.createWriteStream(this.fileName).getWriter()

    this.fileSystem.getRoot()
      .then(dir => dir.readEntries())
      .then(entries => {
        let files = entries.filter(entry => entry.name !== this.fileName).sort((a, b) => {
          if (a.name < b.name) return -1
          if (a.name > b.name) return 1
          return 0
        })

        files.forEach(file => {
          console.log(file.name)
          file.getFile().then(file => {
            file.readAsArrayBuffer(buffer => this.writer.write(buffer))
          })

          file.remove()
        })

        this.writer.close()
      })
  }

  cancel () {
    this.controller.abort()
    if (this.writer) {
      this.writer.close()
    }

    return Promise.resolve()
  }
}
