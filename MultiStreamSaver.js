window.multiStreamSaver = (() => {
  let secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  let multiStreamSaver = {
    createWriteStream,
    supported: false,
    version: {
      full: '1.0.0',
      major: 1,
      minor: 0,
      dot: 0
    }
  }

  multiStreamSaver.mitm = 'mitm.html?version=' + multiStreamSaver.version.full

  try {
    // Some browser has it but ain't allowed to construct a stream yet
    multiStreamSaver.supported = 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
  } catch (err) {
    // if you are running chrome < 52 then you can enable it
    // `chrome://flags/#enable-experimental-web-platform-features`
  }

  function createWriteStream (filename, queuingStrategy, size) {
    // normalize arguments
    if (Number.isFinite(queuingStrategy)) {
      [size, queuingStrategy] = [queuingStrategy, size]
    }

    let channel = new MessageChannel()
    let setupChannel = () => new Promise((resolve, reject) => {
      channel.port1.onmessage = event => {
        if (event.data.url) {
          resolve()
          if (!secure) {
            window.mitm.close() // don't need the mitm any longer
          }
          let link = document.createElement('a')
          let click = new MouseEvent('click')
          link.href = event.data.url + event.data.uniq
          link.dispatchEvent(click)
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

    return new WritableStream({
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
      abort (e) {
        channel.port1.postMessage('abort')
      }
    }, queuingStrategy)
  }

  return multiStreamSaver
})()
