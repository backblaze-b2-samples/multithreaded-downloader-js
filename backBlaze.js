(() => {
  let mtd = new MultiThreadedDownloader()

  !mtd.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

  // const accountID = 'e949706fe14a'
  // const apiUrl = 'https://api002.backblazeb2.com'
  // const applicationKey = '002370c2f2ad311d2bd2a189368f58354dd2495e19'
  // const credentials = window.btoa(`${accountID}:${applicationKey}`)
  // const downloadKey = '3_20180509062706_bb6088159451eb57b33c51c4_799b49c13526c2c0bf2f9dec00a174d4ba762712_002_20180510062706_0013_dnld'

  let fileList = document.getElementById('B2FileList')
  fileList.onclick = event => {
    let index = event.target.options.selectedIndex
    let fileName = event.target.options[index].value
    if (index > 0) {
      downloadFile(fileName)
    }
  }

  function downloadFile (fullName) {
    fullName = fullName.split('/')
    const bucketName = fullName[0]
    const fileName = fullName[1]
    // Add "intercept=true" parameter so service worker can intercept request
    fetch(`https://f002.backblazeb2.com/file/${bucketName}/${fileName}?intercept=true`, {
      method: 'GET'
    }).then(response => response.blob())
      .then(blob => {
        let click = new MouseEvent('click')
        let link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        link.dispatchEvent(click)
      })
  }
})()
