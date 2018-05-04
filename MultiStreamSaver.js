let multiStreamSaver = {
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

      if (!secure) {
        console.log('Not secure!')
        window.mitm = window.open('mitm.html', Math.random())
        let postReadyMessage = event => {
          if (event.source === window.mitm) {
            // Cross origin doesn't allow scripting so .onload() won't work for the
            // "mitm", but postMessage does
            window.mitm.postMessage({
              filename,
              size
            }, '*', [channel.port2])
            window.removeEventListener('message', postReadyMessage)
          }
        }

        window.addEventListener('message', postReadyMessage)
      }

      if (!window.iframe) {
        console.log('creating mitm iframe')
        window.iframe = document.createElement('iframe')
        window.iframe.src = 'mitm.html'
        window.iframe.hidden = true
        document.body.appendChild(window.iframe)
      }

      let iframeLoaded = event => {
        console.log('mitm iframe loaded')
        window.iframe.removeEventListener('load', iframeLoaded)
        console.log('postMessage from mitm iframe')
        window.iframe.contentWindow.postMessage({
          filename,
          size
        }, '*', [channel.port2])
      }

      window.iframe.addEventListener('load', iframeLoaded)
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
