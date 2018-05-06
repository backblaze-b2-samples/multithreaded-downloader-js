const map = new Map()

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
self.onmessage = event => {
  // let url = self.registration.scope
  // Create a uniq link for the download
  let uniq = Math.random()
  let port = event.ports[0]

  let p = new Promise((resolve, reject) => {
    let stream = createStream(resolve, reject, port)
    map.set(event.data.fileName, [stream, event.data])
    port.postMessage({fileName: event.data.fileName, uniq: uniq})
  })

  // Beginning in Chrome 51, event is an ExtendableMessageEvent, which supports
  // the waitUntil() method for extending the lifetime of the event handler
  // until the promise is resolved.
  if ('waitUntil' in event) {
    event.waitUntil(p)
  }

  // Without support for waitUntil(), there's a chance that if the promise chain
  // takes "too long" to execute, the service worker might be automatically
  // stopped before it's complete.
}

function createStream (resolve, reject, port) {
  // ReadableStream is only supported by chrome 52
  let bytesWritten = 0
  return new ReadableStream({
    start (controller) {
      // When we receive data on the messageChannel, we write
      port.onmessage = ({data}) => {
        if (data === 'end') {
          resolve()
          return controller.close()
        }

        if (data === 'abort') {
          resolve()
          controller.error('Aborted the download')
          return
        }

        controller.enqueue(data)
        bytesWritten += data.byteLength
        port.postMessage({bytesWritten})
      }
    },
    cancel () {
      console.log('user aborted')
    }
  })
}

self.onfetch = event => {
  let url = event.request.url
  let hijackEvent = map.get(url)

  if (!hijackEvent) {
    console.log('fail')
    return null
  }
  console.log('handling ', url)

  let [stream, data] = hijackEvent
  map.delete(url)

  let filename = typeof data === 'string' ? data : data.filename
  // Make filename RFC5987 compatible
  filename = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')

  let contentLength = 10240
  let headers = {
    'Content-Type': 'application/octet-stream; charset=utf-8',
    'Content-Disposition': "attachment; filename*=UTF-8''" + filename
    // 'Range': `bytes=1024-2047/${contentLength}`
  }

  if (data.size) {
    headers['Content-Length'] = data.size
  }

  event.respondWith(new Response(stream, {headers}))
}
