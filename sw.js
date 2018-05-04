// Size of one chunk when requesting with Range
const CHUNK_SIZE = 2048

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
  console.log('onHeadResponse', response)
  const promises = Array.from({
    length: Math.ceil(contentLength / CHUNK_SIZE)
  }).map((_, i) => {
    const headers = new Headers(request.headers)
    headers.append('Range', `bytes=${i * CHUNK_SIZE}-${(i * CHUNK_SIZE) + CHUNK_SIZE - 1}/${contentLength}`)

    return fetch(new Request(request, { headers }))
  })

  return Promise.all(promises)
    .then(responses => Promise.all(responses.map(res => res.arrayBuffer())))
    .then(buffers => new Response(buffers.reduce(concatArrayBuffer), { headers: response.headers }))
}

// Triggers each time when fetch event fires in Service Worker
function onFetch (event) {
  const url = new URL(event.request.url)

  if (url.origin === 'https://f000.backblazeb2.com') {
    const request = new Request(event.request, { method: 'HEAD' })
    console.log('intercept', request)


    return event.respondWith(
      fetch(request).then(response => {
        const reader = response.body.getReader()
        const stream = new ReadableStream({
          start (controller) {
            // The following function handles each data chunk
            function push () {
              // "done" is a Boolean and value a "Uint8Array"
              reader.read().then(({ done, value }) => {
                // Is there no more data to read?
                if (done) {
                  // Tell the browser that we have finished sending data
                  controller.close()
                  return
                }
                // Get the data and send it to the browser via the controller
                controller.enqueue(value)
                push()
              })
            }
            push()
          }
        })

        console.log(new Response(stream))
        // let init = {
        //   headers: {},
        //   status: response.status,
        //   statusText: response.statusText
        // }
        // response.headers.forEach((value, key) => {
        //   init.headers[key] = value
        // })
        // return new Response(response.body, init)
      }))

    // return event.respondWith(fetch(event.request, { method: 'HEAD', mode: 'no-cors' }).then(onHeadResponse.bind(this, event.request)))
  }

  if (event.request.mode === 'navigate') {
    return event.respondWith(fetch(event.request))
  }

  if (url.origin === location.origin) {
    return event.respondWith(fetch(event.request, { mode: 'same-origin' }))
  }

  return event.respondWith(fetch(event.request))
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', onFetch)
