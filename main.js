window.addEventListener('MultiStreamSaver::mitmLoaded', () => {
  console.log('MultiStreamSaver::mitmLoaded')
})

!multiStreamSaver.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

let fileName = 'uploads-small.tar.gz'
// let fileName = 'uploads-smallmedium.tar.gz'
let url = 'https://f000.backblazeb2.com/file/nilayp/'

// Here we could just simply open the link and then let
// the SW add Content-Disposition header to that request.
window.fetch(url + fileName, {mode: 'no-cors'})
  .then(response => {
    return response.blob()
  })
  .then(blob => {
    let fileStream = multiStreamSaver.createWriteStream(fileName)

    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
    // response.pipeTo(fileStream)
    // return blob.pipeTo(fileStream)
    // console.log(blob)

    // // https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
    // let reader = response.getReader()

    // let writer = fileStream.getWriter()
    // Close the stream so we stop writing OR write one chunk, then get the next one
    // let pump = () => reader.read().then(
    //   res => res.done
    //     ? writer.close()
    //     : writer.write(res.value).then(pump))
    //
    // pump()
  })
