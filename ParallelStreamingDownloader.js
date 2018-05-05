class ParallelStreamingDownloader {
  constructor () {
    this.secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  }

  supported () {
    try {
      // Some browser has it but ain't allowed to construct a stream yet
      return 'serviceWorker' in navigator && !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (err) {
      // if you are running chrome < 52 then you can enable it
      // `chrome://flags/#enable-experimental-web-platform-features`
      return false
    }
  }

  createWriteStream (fileName, queuingStrategy, fileSize) {
    // normalize arguments
    if (Number.isFinite(queuingStrategy)) {
      [fileSize, queuingStrategy] = [queuingStrategy, fileSize]
    }

    this.fileName = fileName
    this.queuingStrategy = queuingStrategy
    this.fileSize = fileSize
    this.setupMessageChannel()

    return new window.WritableStream({
      start (controller) {
        // is called immediately, and should perform any actions
        // necessary to acquire access to the underlying sink.
        // If this process is asynchronous, it can return a promise
        // to signal success or failure.
        return this.messageChannelSetupPromise
      },
      write (chunk) {
        // is called when a new chunk of data is ready to be written
        // to the underlying sink. It can return a promise to signal
        // success or failure of the write operation. The stream
        // implementation guarantees that this method will be called
        // only after previous writes have succeeded, and never after
        // close or abort is called.

        // TODO: Kind of important that service worker respond back when
        // it has been written. Otherwise we can't handle backpressure
        this.messageChannel.port1.postMessage(chunk)
      },
      close () {
        this.messageChannel.port1.postMessage('end')
        console.log('All data successfully read!')
      },
      abort () {
        this.messageChannel.port1.postMessage('abort')
      }
    }, queuingStrategy)
  }

  setupMessageChannel () {
    this.messageChannel = new window.MessageChannel()
    this.messageChannelSetupPromise = () => new Promise((resolve, reject) => {
      this.messageChannel.port1.onmessage = event => {
        if (event.data.url) {
          resolve()
          if (!this.secure) {
            this.mitm.close() // don't need the mitm any longer
          }
          // let link = document.createElement('a')
          // let click = new window.MouseEvent('click')
          // link.href = event.data.url
          // link.dispatchEvent(click)
        }
      }

      if (!this.secure) {
        console.log('not secure!')
        this.mitm = window.open('mitm.html', Math.random())
      }

      if (!this.mitm) {
        console.log('creating mitm')
        this.mitm = document.createElement('iframe')
        this.mitm.src = 'mitm.html'
        this.mitm.hidden = true
        document.body.appendChild(this.mitm)
      }

      this.mitm.addEventListener('load', this._mitmLoaded)
      window.addEventListener('message', this._mitmReady)
    })
  }

  _mitmLoaded (event) {
    console.log('mitm loaded')
    this.mitm.removeEventListener('load', this._mitmLoaded)
    this._mitmPostMessage(this.fileName, this.fileSize).bind(this)
  }

  _mitmReady (event) {
    if (event.source === this.mitm) {
      // Cross origin doesn't allow scripting so .onload() won't work for the
      // "mitm", but postMessage does
      window.removeEventListener('message', this._mitmReady)
      this._mitmPostMessage(this.fileName, this.fileSize).bind(this)
    }
  }

  _mitmPostMessage (fileName, fileSize) {
    this.mitm.contentWindow.postMessage({
      fileName,
      fileSize
    }, '*', [this.messageChannel.port2])
  }
}
