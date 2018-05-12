let retryFetch = function (url, options) {
  let retries = 3
  let retryDelay = 1000
  let retryOn = []

  if (options && options.retries) {
    retries = options.retries
  }

  if (options && options.retryDelay) {
    retryDelay = options.retryDelay
  }

  if (options && options.retryOn) {
    if (options.retryOn instanceof Array) {
      retryOn = options.retryOn
    }
  }

  return new Promise(function (resolve, reject) {
    function retryFetch (n) {
      fetch(url, options)
        .then(function (response) {
          if (retryOn.indexOf(response.status) === -1) {
            resolve(response)
          } else {
            if (n > 0) {
              retry(n)
            } else {
              reject(response)
            }
          }
        })
        .catch(function (error) {
          if (n > 0) {
            retry(n)
          } else {
            reject(error)
          }
        })
    }

    function retry (n) {
      setTimeout(function () {
        console.log('retryFetch: retry: ', retryDelay)
        retryFetch(--n)
      }, retryDelay)
    }

    retryFetch(retries)
  })
}

// Concat two ArrayBuffers
function concatArrayBuffer (ab1, ab2) {
  const tmp = new Uint8Array(ab1.byteLength + ab2.byteLength)
  tmp.set(new Uint8Array(ab1), 0)
  tmp.set(new Uint8Array(ab2), ab1.byteLength)
  return tmp.buffer
}

// "Access-Control-Expose-Headers: Content-Length" must be enabled for HEAD requests!
// Triggers when a HEAD request is successful. Returns a promise that fulfils into a new Response object
// https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f
function onHeadResponse (request, options, response) {
  // Google drive response headers are all lower case, B2's are not!
  const contentLength = response.headers.get('Content-Length') || response.headers.get('content-length')
  const chunkSize = Math.ceil(contentLength / options.threads)
  const numChunks = Math.ceil(contentLength / chunkSize)

  let promises = []
  for (let i = 0; i < numChunks; i++) {
    const headers = new Headers(request.headers)
    headers.append('Range', `bytes=${i * chunkSize}-${(i * chunkSize) + chunkSize - 1}`)
    options = Object.assign(options, {
      headers: headers,
      method: 'GET',
      mode: 'cors'
    })
    promises.push(retryFetch(request.url, options))
  }

  const headers = new Headers(response.headers)
  headers.append('Content-Disposition', `attachment; filename="${options.fileName}"`)

  return Promise.all(promises)
    .then(responses => Promise.all(responses.map(res => res.arrayBuffer())))
    .then(buffers => new Response(buffers.reduce(concatArrayBuffer, new Uint8Array()), {headers: headers}))
}

self.onfetch = event => {
  let url = new URL(event.request.url)
  let pathname = url.pathname.split('/')
  // intercept all requests with "threads" parameter
  if (url.searchParams.get('threads')) {
    // get any additional parameters
    let options = {
      fileName: pathname[pathname.length - 1],
      retries: url.searchParams.get('retries') || 3,
      retryDelay: url.searchParams.get('retryDelay') || 1000,
      retryOn: url.searchParams.get('retryOn') || [],
      threads: url.searchParams.get('threads')
    }

    // remove any additional parameters
    url.searchParams.delete('retries')
    url.searchParams.delete('retryDelay')
    url.searchParams.delete('retryOn')
    url.searchParams.delete('threads')

    let req = new Request(url.href, {
      headers: event.request.headers,
      method: 'HEAD',
      mode: event.request.mode
    })

    return event.respondWith(retryFetch(req, options).then(onHeadResponse.bind(this, req, options)))
    // let headers = {
    //   'Content-Type': 'application/octet-stream; charset=utf-8',
    //   'Content-Disposition': "attachment; filename*=UTF-8''" + filename
    // }
    // if (data.size) {
    //   headers['Content-Length'] = data.size
    // }
    // event.respondWith(new Response(stream, {headers}))
  }

  // default requests
  if (event.request.mode === 'navigate') {
    return event.respondWith(fetch(event.request))
  }

  if (url.origin === location.origin) {
    return event.respondWith(fetch(event.request, {mode: 'same-origin'}))
  }

  return event.respondWith(fetch(event.request))
}

// always install updated service worker immediately
self.addEventListener('install', event => {
  self.skipWaiting()
})

// function createStream (resolve, reject, port) {
//   // ReadableStream is only supported by chrome 52
//   let bytesWritten = 0
//   return new ReadableStream({
//     start (controller) {
//       // When we receive data on the messageChannel, we write
//       port.onmessage = ({data}) => {
//         if (data === 'end') {
//           resolve()
//           return controller.close()
//         }
//
//         if (data === 'abort') {
//           resolve()
//           controller.error('Aborted the download')
//           return
//         }
//
//         controller.enqueue(data)
//         bytesWritten += data.byteLength
//         port.postMessage({bytesWritten})
//       }
//     },
//     cancel () {
//       console.log('user aborted')
//     }
//   })
// }
