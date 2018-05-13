function respondWithProgressMonitor (options, response) {
  const contentLength = response.headers.get('content-length')
  const total = parseInt(contentLength, 10)
  const reader = response.body.getReader()
  let loaded = 0

  return new Response(
    new ReadableStream({
      start (controller) {
        // get client to post message. Awaiting resolution first read() progress
        // is sent for progress indicator accuracy
        let client
        clients.get(options.clientId).then(c => {
          client = c
          read()
        })

        function read () {
          reader.read().then(({done, value}) => {
            if (done) {
              controller.close()
              return
            }

            controller.enqueue(value)
            loaded += value.byteLength
            // console.log('    SW', Math.round(loaded/total*100)+'%');
            dispatchProgress({client, loaded, total, chunk: options.chunk, url: response.url})
            read()
          }).catch(error => {
            // error only typically occurs if network fails mid-download
            console.error('error in read()', error)
            controller.error(error)
          })
        }
      },

      // Firefox excutes this on page stop, Chrome does not
      cancel (reason) {
        console.log('cancel()', reason)
      }
    })
  )
}

function dispatchProgress ({client, loaded, total, chunk, url}) {
  client.postMessage({loaded, total, chunk, url})
}

function fetchRetry (url, options) {
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
    function fetchRetry (retriesRemaining) {
      fetch(url, options)
        .then(function (response) {
          if (retryOn.indexOf(response.status) === -1) {
            resolve(response)
          } else {
            if (retriesRemaining > 0) {
              retry(retriesRemaining)
            } else {
              reject(response)
            }
          }
        })
        .catch(function (error) {
          if (retriesRemaining > 0) {
            retry(retriesRemaining)
          } else {
            reject(error)
          }
        })
    }

    function retry (retriesRemaining) {
      setTimeout(() => {
        fetchRetry(--retriesRemaining)
      }, retryDelay)
    }

    fetchRetry(retries)
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

  // Build range requests
  let promises = []
  for (let i = 0; i < numChunks; i++) {
    const headers = new Headers(request.headers)
    headers.append('Range', `bytes=${i * chunkSize}-${(i * chunkSize) + chunkSize - 1}`)
    options = Object.assign(options, {
      headers: headers,
      method: 'GET',
      mode: 'cors'
    })

    promises.push(fetchRetry(request.url, options).then(response => respondWithProgressMonitor({chunk: i + 1, clientId: options.clientId}, response)))
  }

  const headers = new Headers(response.headers)
  headers.append('Content-Disposition', `attachment; filename="${options.fileName}"`)

  // Map respones to arrayBuffers, reduce to single arrayBuffer for final response
  return Promise.all(promises)
    .then(responses => Promise.all(responses.map(res => res.arrayBuffer())))
    .then(buffers => new Response(buffers.reduce(concatArrayBuffer, new Uint8Array()), {headers: headers}))
}

// Opaque responses don't allow access to Content-Length header or .getReader()
// on Response.body, both of which are required to calculate download progress.
// "Access-Control-Allow-Origin" header must not be a wildcard '*' when the
// request's credentials mode is 'include'.

self.onfetch = event => {
  let url = new URL(event.request.url)

  // Intercept all requests with "threads" parameter in the url
  if (url.searchParams.get('threads')) {
    // Get any additional url parameters
    const pathname = url.pathname.split('/')
    const options = {
      clientId: event.clientId,
      fileName: pathname[pathname.length - 1],
      retries: url.searchParams.get('retries') || 3,
      retryDelay: url.searchParams.get('retryDelay') || 1000,
      retryOn: url.searchParams.get('retryOn') || [],
      threads: url.searchParams.get('threads')
    }

    // Remove any additional url parameters
    url.searchParams.delete('retries')
    url.searchParams.delete('retryDelay')
    url.searchParams.delete('retryOn')
    url.searchParams.delete('threads')

    // Build new HEAD request with the original headers and mode
    let HEADRequest = new Request(url.href, {
      headers: event.request.headers,
      method: 'HEAD',
      mode: event.request.mode
    })

    return event.respondWith(fetchRetry(HEADRequest, options).then(onHeadResponse.bind(this, HEADRequest, options)))
  }

  // Default requests
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
