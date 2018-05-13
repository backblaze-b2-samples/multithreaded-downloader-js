class MultiThreadedDownloader {
  constructor () {
    if (this.supported()) {
      this.progressElements = []
      navigator.serviceWorker.addEventListener('message', event => this.progress(event.data))
      navigator.serviceWorker.register('serviceWorker.js')
      // scope: window.location.href
    } else {
      console.error('Either Service Workers or Web Streams are not supported!')
    }
  }

  supported () {
    try {
      return 'serviceWorker' in navigator && !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (err) {
      return false
    }
  }

  progress ({loaded, total, chunk, url}) {
    if (!this.progressElements[url + chunk]) {
      let el = document.createElement('progress')
      el.classList.add('progressBar')
      this.progressElements[url + chunk] = el
      document.getElementById('progressArea').appendChild(el)
    }
    this.progressElements[url + chunk].value = loaded / total
  }

  createWriteStream (fileName, queuingStrategy, fileSize) {
    // normalize arguments
    if (Number.isFinite(queuingStrategy)) {
      [fileSize, queuingStrategy] = [queuingStrategy, fileSize]
    }

    this.fileName = fileName
    this.fileSize = fileSize
    this.queuingStrategy = queuingStrategy

    return new window.WritableStream({
      start (controller) {
        // is called immediately, and should perform any actions necessary to
        // acquire access to the underlying sink. If the process is asynchronous,
        // it can return a promise to signal success or failure.
        // return setupMessageChannel()
      },
      write (chunk) {
        // is called when a new chunk of data is ready to be written to the
        // underlying sink. It can return a promise to signal success or failure
        // of the write operation. The stream implementation guarantees that
        // this method will be called only after previous writes have succeeded,
        // and never after close or abort is called.

        // TODO: Kind of important that service worker respond back when it has
        // been written. Otherwise we can't handle backpressure
        // messageChannel.port1.postMessage(chunk)
      },
      close () {
        // messageChannel.port1.postMessage('end')
        console.log('All data successfully written!')
      },
      abort () {
        // messageChannel.port1.postMessage('abort')
      }
    }, queuingStrategy)
  }
}
