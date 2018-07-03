const fs = window.fs

class MultiThread {
  constructor (options) {
    Object.assign(this, options)
    this.onStart = this.onStart ? this.onStart.bind(this) : () => {}
    this.onFinish = this.onFinish ? this.onFinish.bind(this) : () => {}
    this.onProgress = this.onProgress ? this.onProgress.bind(this) : () => {}
    this.onError = this.onError ? this.onError.bind(this) : () => {}

    this.loaded = 0
    this.url = new URL(this.url)
    this.headers = new Headers(this.headers)
    this.controller = new AbortController()
    this.queue = new PromiseQueue({
      concurrency: this.threads,
      signal: this.controller.signal,
      onFinish: () => this.concatChunks().then(this.onFinish)
    })

    window.fetch(this.url, {
      method: 'HEAD',
      mode: 'cors',
      headers: this.headers,
      signal: this.controller.signal
    })
      .then(response => {
        this.contentLength = parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))
        this.chunkTotal = Math.ceil(this.contentLength / this.chunkSize)
        this.onStart({contentLength: this.contentLength, chunks: this.chunkTotal})

        fs.init({bytes: this.contentLength, type: window.TEMPORARY})
          .then(() => fs.clear())
          .then(() => {
            for (let id = 0; id < this.chunkTotal; id++) {
              this.buildChunk(id).then(chunk => this.addToQueue(chunk))
            }
          })
      })

    return this
  }

  buildChunk (id) {
    const chunk = new Chunk({
      id: id,
      url: this.url,
      headers: this.headers,
      controller: this.controller,
      startByte: id * this.chunkSize,
      endByte: id * this.chunkSize + this.chunkSize - 1,
      onStart: this.onChunkStart,
      onFinish: this.onChunkFinish,
      onError: this.onChunkError,
      onProgress: ({id, contentLength, loaded, byteLength}) => {
        this.loaded += byteLength
        this.onProgress({contentLength: this.contentLength, loaded: this.loaded})
        this.onChunkProgress({contentLength: contentLength, loaded: loaded, id: id})
      }
    })

    return new Promise((resolve, reject) => resolve(chunk))
  }

  addToQueue (chunk) {
    this.queue.add(() => new Promise((resolve, reject) => {
      chunk.start()
        .then(response => response.blob())
        .then(blob => fs.writeFile(`${chunk.startByte}-${chunk.endByte}`, blob))
        .then(resolve)
        .catch(error => reject(error))
    }), {attempts: this.retries})
  }

  concatChunks () {
    return fs.readdir('/')
      .then(chunks => chunks.sort((a, b) => {
        const [aStart] = a.name.split('-').map(parseInt)
        const [bStart] = b.name.split('-').map(parseInt)
        if (aStart < bStart) return -1
        if (aStart > bStart) return 1
        return 0
      }))
      .then(chunks => {
        const chunkQueue = new PromiseQueue({
          signal: this.controller.signal,
          onFinish: () => this.download(this.outputFile)
        })

        for (let id = 0; id < chunks.length; id++) {
          const chunkPath = chunks[id].fullPath

          chunkQueue.add(() => new Promise((resolve, reject) => {
            fs.readFile(chunkPath, {type: 'ArrayBuffer'})
              .then(buffer => fs.appendFile(this.fileName, buffer))
              .then(outputFile => {
                this.outputFile = outputFile
                fs.unlink(chunkPath)
                  .then(resolve)
              })
              .catch(error => reject(error))
          }), {attempts: this.retries})
        }
      })
  }

  download (file) {
    const link = document.createElement('a')
    link.download = this.fileName

    return fs.getUrl(file)
      .then(url => {
        link.href = url
        link.click()
      })
  }

  cancel () {
    this.controller.abort()

    // if (this.writer) {
    //   this.writer.close()
    // }

    return Promise.resolve()
  }
}

// module.exports = MultiThread
