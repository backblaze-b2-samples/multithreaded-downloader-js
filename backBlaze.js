(() => {
  let mtd = new MultiThreadedDownloader()

  !mtd.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

  // From your B2 account page
  const accountID = 'e949706fe14a'
  const applicationKey = '00262a1255b8e8250477967f6a253edd25c9f042ce'
  const credentials = window.btoa(`${accountID}:${applicationKey}`)
  const apiUrl = 'https://api002.backblazeb2.com'

  window.fetch(`${apiUrl}/b2api/v1/b2_authorize_account`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`
    },
    mode: 'cors',
    credentials: 'include'
  }).then(response => response.json())
    .then(json => {
      console.log(json)
      // const authorizationToken = json.authorizationToken
    })

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
    fetch(`${url}?intercept=true`, {mode: 'cors'})
      .then(response => response.blob())
      .then(blob => {
        let click = new MouseEvent('click')
        let link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        link.dispatchEvent(click)
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
