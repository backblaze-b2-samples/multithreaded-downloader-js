(() => {
  let mtd = new MultiThreadedDownloader()
  const bucketName = 'nilayp'
  const clusterNum = '000'

  document.getElementById('B2Download').onclick = event => {
    const fileList = document.getElementById('B2FileList')
    const index = fileList.options.selectedIndex
    const fileName = fileList.options[index].value
    const threads = parseInt(document.getElementById('B2Threads').value)
    const retries = parseInt(document.getElementById('B2Retries').value)
    const retryDelay = parseInt(document.getElementById('B2RetryDelay').value)
    if (index > 0) {
      // Clear out any progress elements
      let el = document.getElementById('progressArea')
      while (el.firstChild) {
        el.removeChild(el.firstChild)
      }
      downloadFile(clusterNum, bucketName, fileName, threads, retries, retryDelay)
    }
  }

  let controller = new AbortController()
  let signal = controller.signal

  document.getElementById('B2Cancel').onclick = event => {
    controller.abort()
  }

  function downloadFile (clusterNum, bucketName, fileName, threads, retries, retryDelay) {
    const url = new URL(`https://f${clusterNum}.backblazeb2.com/file/${bucketName}/${fileName}`)
    url.searchParams.set('threads', threads)
    url.searchParams.set('retries', retries)
    url.searchParams.set('retryDelay', retryDelay)

    fetch(url, {
      method: 'GET',
      signal
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
