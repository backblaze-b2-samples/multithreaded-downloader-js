(() => {
  let mtd = new MultiThreadedDownloader()

  !mtd.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

  const accountID = 'e949706fe14a'
  const apiUrl = 'https://api002.backblazeb2.com'
  const applicationKey = '00262a1255b8e8250477967f6a253edd25c9f042ce'
  const credentials = window.btoa(`${accountID}:${applicationKey}`)
  const downloadKey = '3_20180509062706_bb6088159451eb57b33c51c4_799b49c13526c2c0bf2f9dec00a174d4ba762712_002_20180510062706_0013_dnld'
  const downloadUrl = 'https://f002.backblazeb2.com'

  // window.fetch(`${apiUrl}/b2api/v1/b2_authorize_account`, {
  //   method: 'GET',
  //   headers: {
  //     'Authorization': `Basic ${credentials}`
  //   },
  //   mode: 'cors',
  //   credentials: 'include'
  // }).then(response => {
  //   console.log(response)
  //   // const authorizationToken = json.authorizationToken
  // })

  let fileList = document.getElementById('B2FileList')
  fileList.onclick = event => {
    let index = event.target.options.selectedIndex
    let fileName = event.target.options[index].value
    if (index > 0) {
      downloadFile(fileName)
    }
  }

  function downloadFile (fileName) {
    // let fileStream = mtd.createWriteStream(fileName)


    // Add "intercept=true" parameter so service worker can intercept request
    fetch(`${downloadUrl}/file/BarFoo/${fileName}?intercept=true`, {
      method: 'GET',
      headers: {
        'Authorization': downloadKey
      },
      mode: 'cors',
      credentials: 'include'
    }).then(response => response.blob())
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
