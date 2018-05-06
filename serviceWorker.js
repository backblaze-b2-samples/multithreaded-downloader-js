const map = new Map()

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
self.onmessage = event => {
  console.log(event.data.fileName + ' added to set')
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

// Size of one chunk when requesting with Range
let CHUNK_SIZE = 5120000
let NUM_CHUNKS = 8

// Concat two ArrayBuffers
function concatArrayBuffer (ab1, ab2) {
  const tmp = new Uint8Array(ab1.byteLength + ab2.byteLength)
  tmp.set(new Uint8Array(ab1), 0)
  tmp.set(new Uint8Array(ab2), ab1.byteLength)
  return tmp.buffer
}

// Triggers each time when HEAD request is successful. Returns promise that fulfils into new Response object
function onHeadResponse (request, response) {
  const contentLength = response.headers.get('content-length')
  CHUNK_SIZE = Math.ceil(contentLength / NUM_CHUNKS)
  const promises = Array.from({
    length: Math.ceil(contentLength / CHUNK_SIZE)
  }).map((_, i) => {
    const headers = new Headers(request.headers)
    // headers.append('Range', `bytes=${i * CHUNK_SIZE}-${ (i * CHUNK_SIZE) + CHUNK_SIZE - 1}/${contentLength}`)
    headers.append('Range', `bytes=${i * CHUNK_SIZE}-${ (i * CHUNK_SIZE) + CHUNK_SIZE - 1}`)

    // console.log(`Range header: ${headers.get('Range')}`)
    return fetch(request, {method: 'GET', headers})
  })

  return Promise.all(promises)
    .then(responses => Promise.all(responses.map(res => res.arrayBuffer())))
    .then(buffers => new Response(buffers.reduce(concatArrayBuffer), {headers: response.headers}))
}

self.onfetch = event => {
  let url = new URL(event.request.url)
  // let hijackEvent = map.get(url)

  // if (!hijackEvent) {
  //   console.log(url + ' not found')
  //   return null
  // }
  if (url.searchParams.get('intercept')) {
    url.searchParams.delete('intercept')
    console.log('intercept', url)
    event.request.url = url.href
    return event.respondWith(fetch(event.request, {method: 'HEAD'}).then(onHeadResponse.bind(this, event.request)))
  }

  // let [stream, data] = hijackEvent
  // map.delete(url)
  //
  // let filename = typeof data === 'string' ? data : data.filename
  // // Make filename RFC5987 compatible
  // filename = encodeURIComponent(filename)
  //   .replace(/['()]/g, escape)
  //   .replace(/\*/g, '%2A')
  //
  // let headers = {
  //   'Content-Type': 'application/octet-stream; charset=utf-8',
  //   'Content-Disposition': "attachment; filename*=UTF-8''" + filename
  // }
  //
  // if (data.size) {
  //   headers['Content-Length'] = data.size
  // }
  //
  // event.respondWith(new Response(stream, {headers}))

  if (event.request.mode === 'navigate') {
    return event.respondWith(fetch(event.request))
  }

  if (url.origin === location.origin) {
    return event.respondWith(fetch(event.request, {mode: 'same-origin'}))
  }

  // return event.respondWith(fetch(event.request))
}
