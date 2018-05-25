(() => {
  const chunkSizeType = document.getElementById('chunkSizeType')
  const chunkSizeInput = document.getElementById('chunkSize')
  const threadsType = document.getElementById('threadsType')
  const threadsInput = document.getElementById('threads')
  const retryDelayInput = document.getElementById('retryDelay')
  const retriesInput = document.getElementById('retries')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const cancelButton = document.getElementById('cancelButton')
  let reqType = 'chunkSize'

  chunkSizeType.onclick = () => {
    reqType = 'chunkSize'
    threadsInput.disabled = true
    chunkSizeInput.disabled = false
  }

  threadsType.onclick = () => {
    reqType = 'threads'
    chunkSizeInput.disabled = true
    threadsInput.disabled = false
  }

  downloadButton.onclick = () => {
    const index = fileList.options.selectedIndex

    if (index > 0) {
      const clusterNum = fileList.options[index].dataset.clusterNum
      const bucketName = fileList.options[index].dataset.bucketName
      const fileName = fileList.options[index].value
      const chunkSize = parseInt(chunkSizeInput.value)
      const threads = parseInt(threadsInput.value)
      const retryDelay = parseInt(retryDelayInput.value)
      const retries = parseInt(retriesInput.value)

      downloadFile({clusterNum, bucketName, fileName, chunkSize, threads, retries, retryDelay, reqType})
    }
  }

  function downloadFile (options) {
    options.controller = new AbortController()
    const url = new URL(`https://f${options.clusterNum}.backblazeb2.com/file/${options.bucketName}/${options.fileName}`)

    new MultiThreadedDownloader(url, options).then(() => {
      cancelButton.setAttribute('disabled', true)
      downloadButton.removeAttribute('disabled')
    })

    downloadButton.setAttribute('disabled', true)
    cancelButton.removeAttribute('disabled')
    cancelButton.onclick = () => {
      cancelButton.setAttribute('disabled', true)
      downloadButton.removeAttribute('disabled')
      options.controller.abort()
    }
  }
})()
