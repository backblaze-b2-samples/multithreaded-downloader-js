(() => {
  document.getElementById('B2Download').onclick = event => {
    const fileList = document.getElementById('B2FileList')
    const index = fileList.options.selectedIndex

    if (index > 0) {
      // Clear out any progress elements
      let el = document.getElementById('progressArea')
      while (el.firstChild) {
        el.removeChild(el.firstChild)
      }

      const clusterNum = fileList.options[index].dataset.clusterNum
      const bucketName = fileList.options[index].dataset.bucketName
      const fileName = fileList.options[index].value
      const threads = parseInt(document.getElementById('B2Threads').value)
      const retries = parseInt(document.getElementById('B2Retries').value)
      const retryDelay = parseInt(document.getElementById('B2RetryDelay').value)

      downloadFile(clusterNum, bucketName, fileName, threads, retries, retryDelay)
    }
  }

  function downloadFile (clusterNum, bucketName, fileName, threads, retries, retryDelay) {
    const url = new URL(`https://f${clusterNum}.backblazeb2.com/file/${bucketName}/${fileName}`)

    const downloader = new MultiThreadedDownloader(url, {threads, retries, retryDelay})
      .then(res => {
        document.getElementById('B2Cancel').setAttribute('disabled', true)
      })

    const cancelButton = document.getElementById('B2Cancel')
    cancelButton.removeAttribute('disabled')
    cancelButton.onclick = event => {
      downloader.controller.abort()
      cancelButton.setAttribute('disabled', true)
    }
  }
})()
