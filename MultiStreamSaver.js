let multiStreamSaver = {
  mitm: 'mitm.html',
  supported: () => {
    let result = false
    try {
      // Some browser has it but ain't allowed to construct a stream yet
      result = 'serviceWorker' in navigator && !!new window.ReadableStream() && !!new window.WritableStream()
    } catch (err) {
      // if you are running chrome < 52 then you can enable it
      // `chrome://flags/#enable-experimental-web-platform-features`
    }

    return result
  },
  createWriteStream: (filename, queuingStrategy, size) => {
    let secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

    // normalize arguments
    if (Number.isFinite(queuingStrategy)) {
      [size, queuingStrategy] = [queuingStrategy, size]
    }

    let channel = new window.MessageChannel()
    let setupChannel = () => new Promise((resolve, reject) => {
      channel.port1.onmessage = event => {
        if (event.data.url) {
          resolve()
          if (!secure) {
            window.mitm.close() // don't need the mitm any longer
          }
          let link = document.createElement('a')
          let click = new window.MouseEvent('click')
          link.href = event.data.url
          // link.dispatchEvent(click)
        }
      }

      if (secure && !window.iframe) {
        window.iframe = document.createElement('iframe')
        window.iframe.src = multiStreamSaver.mitm
        window.iframe.hidden = true
        document.body.appendChild(window.iframe)
      }

      if (secure && !window.loaded) {
        let fn = event => {
          window.loaded = true
          window.iframe.removeEventListener('load', fn)
          window.iframe.contentWindow.postMessage({
            filename,
            size
          }, '*', [channel.port2])
        }

        window.iframe.addEventListener('load', fn)
      }

      if (secure && window.loaded) {
        window.iframe.contentWindow.postMessage({
          filename,
          size
        }, '*', [channel.port2])
      }

      if (!secure) {
        window.mitm = window.open(multiStreamSaver.mitm, Math.random())
        let onready = event => {
          if (event.source === window.mitm) {
            window.mitm.postMessage({
              filename,
              size
            }, '*', [channel.port2])
            window.removeEventListener('message', onready)
          }
        }

        // Another problem that cross origin don't allow is scripting
        // so mitm.onload() doesn't work, but postMessage still does
        window.addEventListener('message', onready)
      }
    })

    return new window.WritableStream({
      start (controller) {
        // is called immediately, and should perform any actions
        // necessary to acquire access to the underlying sink.
        // If this process is asynchronous, it can return a promise
        // to signal success or failure.
        return setupChannel()
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
        channel.port1.postMessage(chunk)
      },
      close () {
        channel.port1.postMessage('end')
        console.log('All data successfully read!')
      },
      abort () {
        channel.port1.postMessage('abort')
      }
    }, queuingStrategy)
  }
}
