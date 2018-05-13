(() => {
  let mtd = new MultiThreadedDownloader()
  const bucketName = 'FooBaz'

  let fileList = document.getElementById('B2FileList')
  fileList.onclick = event => {
    const index = event.target.options.selectedIndex
    const fileName = event.target.options[index].value
    const threads = parseInt(document.getElementById('B2Threads').value)
    const retries = parseInt(document.getElementById('B2Retries').value)
    const retryDelay = parseInt(document.getElementById('B2RetryDelay').value)
    if (index > 0) {
      // Clear out any progress elements
      let el = document.getElementById('progressArea')
      while (el.firstChild) {
        el.removeChild(el.firstChild)
      }
      downloadFile(bucketName, fileName, threads, retries, retryDelay)
    }
  }

  function downloadFile (bucketName, fileName, threads, retries, retryDelay) {
    const url = new URL(`https://f002.backblazeb2.com/file/${bucketName}/${fileName}`)
    url.searchParams.set('threads', threads)
    url.searchParams.set('retries', retries)
    url.searchParams.set('retryDelay', retryDelay)

    fetch(url, {
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
