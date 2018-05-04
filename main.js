window.addEventListener('MultiStreamSaver::mitmLoaded', () => {
  console.log('MultiStreamSaver::mitmLoaded')
})

!multiStreamSaver.supported() && window.prompt(
  'ReadableStream is not supported, you can enable it in chrome, or wait until v52',
  'chrome://flags/#enable-experimental-web-platform-features'
)

let fileName = 'uploads-small.tar.gz'
// let fileName = 'uploads-smallmedium.tar.gz'
let url = 'https://f000.backblazeb2.com/file/nilayp/'

// Here we could just simply open the link and then let
// the SW add Content-Disposition header to that request.
window.fetch(url + fileName, {mode: 'no-cors'})
  .then(response => response.body)
  .then(response => {
    let fileStream = multiStreamSaver.createWriteStream(fileName)
    let writer = fileStream.getWriter()

    console.log(typeof response, response)

    // // https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
    let reader = response.getReader()

    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
    reader.pipeTo(writer)

    // Close the stream so we stop writing OR write one chunk, then get the next one
    // let pump = () => reader.read().then(
    //   res => res.done
    //     ? writer.close()
    //     : writer.write(res.value).then(pump))
    //
    // pump()
  })
