    }
  })
}

// https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f

// Size of one chunk when requesting with Range
// let chunkSize = 5120000
let numThreads = 5

// Concat two ArrayBuffers
function concatArrayBuffer (ab1, ab2) {
  const tmp = new Uint8Array(ab1.byteLength + ab2.byteLength)
  tmp.set(new Uint8Array(ab1), 0)
  tmp.set(new Uint8Array(ab2), ab1.byteLength)
  return tmp.buffer
}

// Triggers each time when HEAD request is successful. Returns promise that fulfils into new Response object
function onHeadResponse (request, response) {
  // Google drive response headers are all lower case, B2 is not!!!
  const contentLength = response.headers.get('Content-Length') || response.headers.get('content-length')
  const chunkSize = Math.ceil(contentLength / numThreads)
  const numChunks = Math.ceil(contentLength / chunkSize)

  // content-length header is not accessible from CORS without
  // "Access-Control-Expose-Headers: Content-Length" enabled from the server
  // https://stackoverflow.com/questions/48266678/how-to-get-the-content-length-of-the-response-from-a-request-with-fetch
  console.log(`${numChunks} threads, ${chunkSize} bytes each`)

  let promises = []
  for (let i = 0; i < numChunks; i++) {
    const headers = new Headers(request.headers)
    // headers.append('Content-Type', 'application/octet-stream; charset=utf-8')
    // headers.append('Content-Disposition', "attachment; filename*=UTF-8''" + filename)
    headers.append('Range', `bytes=${i * chunkSize}-${(i * chunkSize) + chunkSize - 1}`)
    promises.push(fetch(request.url, {headers: headers, method: 'GET', mode: 'cors'}))
  }

  return Promise.all(promises)
    .then(responses => Promise.all(responses.map(res => res.arrayBuffer())))
    .then(buffers => new Response(buffers.reduce(concatArrayBuffer, new Uint8Array()), {headers: response.headers}))
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
