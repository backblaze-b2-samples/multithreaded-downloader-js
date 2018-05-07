(() => {
  let mtd = new MultiThreadedDownloader()

  !mtd.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

  let fileList = document.getElementById('B2FileList')
  fileList.onclick = event => {
    let index = event.target.options.selectedIndex
    let url = event.target.options[index].value
    let fileName = event.target.options[index].innerText
    if (index > 0) {
      downloadFile(url, fileName)
    }
  }

  function downloadFile (url, fileName) {
    let fileStream = mtd.createWriteStream(fileName)

    // Add "intercept=true" parameter so service worker can intercept request
    window.fetch(`${url}?intercept=true`)
      .then(response => response.body)
      .then(body => {
        console.log(body)
        // body.pipeTo(fileStream)
      })
    // .then(blob => {
    //   let fileStream = multiStreamSaver.createWriteStream(fileName)
    //
    //   https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
    //   response.pipeTo(fileStream)
    //   return blob.pipeTo(fileStream)
    //   console.log(blob)
    //
    //    https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
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
})()
