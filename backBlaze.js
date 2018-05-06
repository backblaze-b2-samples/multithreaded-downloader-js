let psd = new ParallelStreamingDownloader()

if (!psd.supported()) {
  console.error('Either ReadableStream or WritableStream is not supported!')
} else {
  let fileName = 'uploads-small.tar.gz'
  let url = 'https://f000.backblazeb2.com/file/nilayp/'
  let fileStream = psd.createWriteStream(fileName)

  // Here we could just simply open the link and then let
  // the SW add Content-Disposition header to that request.
  window.fetch(url + fileName, {method: 'HEAD'})
    .then(response => response.body)
    .then(body => {
      console.log(body)
      // body.pipeTo(fileStream)
      // return response.blob()
    })
  // .then(blob => {
  //   let fileStream = multiStreamSaver.createWriteStream(fileName)
  //
  //   https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
  //   response.pipeTo(fileStream)
  //   return blob.pipeTo(fileStream)
  //   console.log(blob)
  //
  //   // https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
  //   let reader = response.getReader()
  //
  //   let writer = fileStream.getWriter()
  //   Close the stream so we stop writing OR write one chunk, then get the next one
  //   let pump = () => reader.read().then(
  //     res => res.done
  //       ? writer.close()
  //       : writer.write(res.value).then(pump))
  //
  //   pump()
  // })
}
