// Network > Streams API
// TransformStream is part of the Streams API, which is used for creating,
// composing, and consuming streams of data. It enables transforming data in
// stream form. It is typically used in a pipe between a ReadableStream and a
// WritableStream. The following example uses TransformStream to decode text
// received in a streaming response body.
function textDecodeTransform () {
  const decoder = new TextDecoder()
  return new TransformStream({
    transform (chunk, controller) {
      controller.enqueue(decoder.decode(chunk, {stream: true}))
    }
  })
}

fetch(url).then(response => {
  // response.body is a stream of Uint8Array chunks.
  // But if we want chunks of text:
  const stream = response.body.pipeThrough(textDecodeTransform())
});

// ………

(() => {
  async function main() {
    // Create a transform stream with our transformer
    const ts = new TransformStream(new Uint8ArrayToStringsTransformer())
    // Fetch the text file
    const response = await fetch('../linuxArch.png')
    // Get a ReadableStream on the text file's body
    const rs = response.body
    // Apply our Transformer on the ReadableStream to create a stream of strings
    const lineStream = rs.pipeThrough(ts)
    // Read the stream of strings
    const reader = lineStream.getReader()
    while (true) {
      const {done, value} = await reader.read()
      if (done) {
        break
      }
      // Write each string line to the document as a paragraph
      const p = document.createElement('p')
      p.textContent = value
      document.getElementById('section').appendChild(p)
    }
  }

  const source = new ReadableStream({
    async start(controller) {
      // In browsers supporting Web Streams, Fetch's response's body is a ReadableStream
      return fetch('../linuxArch.png').then(async response => {
        // Get a reader on the incoming data
        const reader = response.body.getReader()

        while (true) {
          const {done, value} = await reader.read()

          // When no more data needs to be consumed, break the reading
          if (done) {
            break
          }

          console.log('Reading', value.length, 'bytes')
          // Enqueue the next data chunk into our target stream
          controller.enqueue(value)
        }

        // Close the stream
        controller.close()
        reader.releaseLock()
      }).then(rs => new Response(rs))
      // Create an object URL for the response
        .then(response => response.blob()).then(blob => {
        let link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'linuxArch.png'
        link.dispatchEvent(new MouseEvent('click'))
      })
    }
  })

  const destination = new WritableStream({
    start(controller) {
      // Return a promise to signal the construction is asynchronous
      return new Promise(resolve => {
        const source = new MediaSource()

        // Mark the WritableStream as ready when the source is open
        source.addEventListener('sourceopen', () => {
          this.buffer = source.addSourceBuffer('audio/mpeg')
          resolve()
        })

        player.src = URL.createObjectURL(source)
      })
    },

    write(chunk, controller) {
      // When receiving a chunk append it to the player's buffer
      this.buffer.appendBuffer(chunk)
    }
  })

  const transformer = new TransformStream({
    transform(chunk, controller) {
      // Simply increment each bytes
      const transformed = chunk.map(value => Math.min(value + 1, 255))

      // Enqueue the transformed data
      controller.enqueue(transformed)
    }
  })

  // source.pipeThrough(transformer).pipeTo(destination)
})()

// ……… https://gist.github.com/72lions/4528834
// Concatenates two ArrayBuffers, returns new ArrayBuffer
function _concatenateBuffer (buffer1, buffer2) {
  let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
  tmp.set(new Uint8Array(buffer1), 0)
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
  return tmp.buffer
}

// In ES6+ there's an easier way using the "iterator" property of TypedArrays and the spread operator:
let b1 = new Uint8Array([0x01, 0x02, 0x03])
let b2 = new Uint8Array([0x04, 0x05, 0x06])
let b3 = new Uint8Array([0x07, 0x08, 0x09])

// combine all three arrays into a new array buffer
// if you need the ArrayBuffer instead of a TypedArray, it's at `combined.buffer
// NOTE: square brackets in the Uint8Array constructor -- Uint8Array([...])
let combined = new Uint8Array([
  ...b1,
  ...b2,
  ...b3
])

// ……… https://davidwalsh.name/fetch-timeout

function fetchWithTimeout (url, init) {
  let timedOut = false

  new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      timedOut = true
      reject(new Error('Request timed out'))
    }, init.timeout || 5000)

    fetch(url, init)
      .then(function (response) {
        // Clear the timeout as cleanup
        clearTimeout(timeout)
        if (!timedOut) {
          console.log('fetch good! ', response)
          resolve(response)
        }
      })
      .catch(function (err) {
        console.log('fetch failed! ', err)
        // Rejection already happened with setTimeout
        if (timedOut) return
        // Reject with error
        reject(err)
      })
  })
    .then(function () {
      // Request success and no timeout
      console.log('good promise, no timeout! ')
    })
    .catch(function (err) {
      // Error: response error, request timeout or runtime error
      console.log('promise error! ', err)
    })
}
