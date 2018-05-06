class ParallelStreamingDownloader {
  // constructor () {
  // }

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
    this.fileSize = fileSize
    this.queuingStrategy = queuingStrategy

    const that = this
    return new window.WritableStream({
      start (controller) {
        // is called immediately, and should perform any actions
        // necessary to acquire access to the underlying sink.
        // If this process is asynchronous, it can return a promise
        // to signal success or failure.
        return that.setupMessageChannel()
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
        that.messageChannel.port1.postMessage(chunk)
      },
      close () {
        that.messageChannel.port1.postMessage('end')
        console.log('All data successfully written!')
      },
      abort () {
        that.messageChannel.port1.postMessage('abort')
      }
    }, queuingStrategy)
  }

  setupMessageChannel () {
    let secure =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    this.messageChannel = new window.MessageChannel()
    return new Promise((resolve, reject) => {
      console.log('messageChannelSetupPromise starting')

      this.messageChannel.port1.onmessage = event => {
        if (event.data.fileName) {
          console.log(event)
          resolve()
          if (!secure) {
            this.mitm.close() // don't need the mitm any longer
          }
          let link = document.createElement('a')
          let click = new window.MouseEvent('click')
          link.innerText = 'link'
          link.href = event.data.fileName
          document.body.appendChild(link)
          // link.dispatchEvent(click)
        }
      }

      if (!secure) {
        console.log('not secure, opening mitm in new window!')
        this.mitm = window.open('mitm.html', Math.random())
        window.addEventListener('message', this._mitmMessage)
      } else {
        console.log('mitm created')
        this.mitm = document.createElement('iframe')
        this.mitm.src = 'mitm.html'
        this.mitm.hidden = true
        this.mitm.fileName = this.fileName
        this.mitm.fileSize = this.fileSize
        this.mitm.messageChannelPort = this.messageChannel.port2
        this.mitm.addEventListener('load', this._mitmLoaded)
        document.body.appendChild(this.mitm)

        // this.mitmPostMessage(this.fileName, this.fileSize)
        // window.addEventListener('message', this._mitmMessage)
      }
    })
  }

  _mitmLoaded (event) {
    console.log('mitm loaded')
    this.contentWindow.postMessage({
      fileName: this.fileName,
      fileSize: this.fileSize
    }, '*', [this.messageChannelPort])
    // this.mitm.removeEventListener('load', this._mitmLoaded)
  }

  // _mitmMessage (event) {
  //   console.log(this)
  //   console.log('mitm ready', this.mitm)
  //   if (event.source === this.mitm) {
  //     // Cross origin doesn't allow scripting so .onload() won't work for the
  //     // "mitm", but postMessage does
  //     this.mitmPostMessage(this.fileName, this.fileSize)
  //     window.removeEventListener('message', this._mitmMessage)
  //   }
  // }

  // mitmPostMessage (fileName, fileSize) {
  //   console.log(`mitm postMessage: ${this.fileName}`, this)
  //   this.mitm.contentWindow.postMessage({
  //     fileName,
  //     fileSize
  //   }, '*', [this.messageChannel.port2])
  // }
}
