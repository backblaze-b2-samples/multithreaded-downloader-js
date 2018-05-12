(() => {
  let mtd = new MultiThreadedDownloader()

  let fileList = document.getElementById('B2FileList')
  fileList.onclick = event => {
    let index = event.target.options.selectedIndex
    let fileName = event.target.options[index].value
    let threads = parseInt(document.getElementById('B2Threads').value)
    let retries = parseInt(document.getElementById('B2Retries').value)
    let retryDelay = parseInt(document.getElementById('B2RetryDelay').value)
    if (index > 0) {
      downloadFile(fileName, threads, retries, retryDelay)
    }
  }

  function downloadFile (fullName, threads, retries, retryDelay) {
    fullName = fullName.split('/')
    const bucketName = fullName[0]
    const fileName = fullName[1]

    // Add "threads=(number of threads)" parameter so service worker can intercept request
    fetch(`https://f002.backblazeb2.com/file/${bucketName}/${fileName}?threads=${threads}&retries=${retries}&retryDelay=${retryDelay}`, {
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
