(() => {
  const chunkSizeInput = document.getElementById('chunkSize')
  const threadsInput = document.getElementById('threads')
  const retryDelayInput = document.getElementById('retryDelay')
  const retriesInput = document.getElementById('retries')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const cancelButton = document.getElementById('cancelButton')
  const progressArea = document.getElementById('progressArea')
  let progressElements = []

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

      downloadFile({clusterNum, bucketName, fileName, chunkSize, threads, retries, retryDelay})
    }
  }

  function downloadFile (options) {
    const url = new URL(`https://f${options.clusterNum}.backblazeb2.com/file/${options.bucketName}/${options.fileName}`)
    const multiThread = new MultiThread(options, onProgress, onFinish)

    downloadButton.setAttribute('disabled', true)
    cancelButton.removeAttribute('disabled')

    cancelButton.onclick = () => {
      cancelButton.setAttribute('disabled', true)
      downloadButton.removeAttribute('disabled')
      multiThread.cancel()
    }

    multiThread.fetch(url, options)
  }

  function onFinish () {
    cancelButton.setAttribute('disabled', true)
    downloadButton.removeAttribute('disabled')
  }

  function onProgress ({loaded, contentLength, id}) {
    if (!progressElements[id]) {
      progressElements[id] = document.createElement('progress')
      progressElements[id].value = 0
      progressElements[id].max = 100
      progressArea.appendChild(progressElements[id])
    }

    // handle divide-by-zero edge case when Content-Length=0
    const percent = contentLength ? loaded / contentLength : 1

    if (id === 1) {
      console.log(loaded, contentLength)
    }
    progressElements[id].value = Math.round(percent * 100)
    if (loaded === contentLength) {
      console.log('Loaded 100%')
    }
  }
})()
