window.addEventListener('MultiStreamSaver::mitmLoaded', event => {
  // !window.multiStreamSaver.supported && window.prompt(
  //   'ReadableStream is not supported, you can enable it in chrome, or wait until v52',
  //   'chrome://flags/#enable-experimental-web-platform-features'
  // )
alert('MultiStreamSaver::mitmLoaded')
  // let fileName = 'uploads-small.tar.gz'
  let fileName = 'uploads-smallmedium.tar.gz'
  let url = 'https://f000.backblazeb2.com/file/nilayp/'

  // Here we could just simply open the link and then let
  // the SW add Content-Disposition header to that request.
  window.fetch(url + fileName, {method: 'HEAD', mode: 'no-cors'}).then(response => {
    let fileStream = window.multiStreamSaver.createWriteStream(fileName)
    let writer = fileStream.getWriter()

    // https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
    let reader = response.body.getReader()

    // Close the stream so we stop writing OR write one chunk, then get the next one
    let pump = () => reader.read().then(
      res => res.done
        ? writer.close()
        : writer.write(res.value).then(pump))

    pump()
  })
})
