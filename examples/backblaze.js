(() => {
  const threadsInput = document.getElementById('threads')
  const chunkSizeInput = document.getElementById('chunkSize')
  const retriesInput = document.getElementById('retries')
  const retryDelayInput = document.getElementById('retryDelay')
  const retryOnInput = document.getElementById('retryOn')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const notificationArea = document.getElementById('notificationArea')
  const chunkProgressArea = document.getElementById('chunkProgressArea')

  downloadButton.onclick = startDownload

  function startDownload () {
    const index = fileList.options.selectedIndex

    if (index > 0) {
      const clusterNum = fileList.options[index].dataset.clusterNum
      const bucketName = fileList.options[index].dataset.bucketName
      const threads = parseInt(threadsInput.value)
      const chunkSize = util.mbToBytes(parseInt(chunkSizeInput.value))
      const retries = parseInt(retriesInput.value)
      const retryDelay = parseInt(retryDelayInput.value)
      const retryOn = retryOnInput.value.split(',').map(code => parseInt(code))
      const fileName = fileList.options[index].value

      downloadButton.innerText = 'Cancel'
      downloadFile({clusterNum, bucketName, threads, chunkSize, retries, retryDelay, retryOn, fileName})
    }
  }

  function downloadFile (options) {
    // Remove any previous children in the DOM from previous downloads
    util.removeAllChildren(notificationArea)
    util.removeAllChildren(chunkProgressArea)

    // Change download button into cancel button
    downloadButton.innerText = 'Cancel'
    downloadButton.onclick = () => {
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
      multiThread.cancel()
    }

    let total = 0
    const notification = document.createElement('blockquote')
    options.onStart = ({contentLength, chunks}) => {
      notificationArea.appendChild(notification)
      total = chunks
    }

    options.onFinish = ({contentLength}) => {
      notification.innerText += '\nFinished successfully!'
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
    }

    options.onProgress = ({contentLength, loaded, started}) => {
      // handle divide-by-zero edge case when Content-Length=0
      const percent = contentLength ? loaded / contentLength : 1
      notification.innerText = `Downloading
        ${util.bytesToMb(loaded).toFixed(1)}/${util.bytesToMb(contentLength).toFixed(1)} MB, ${Math.round(percent * 100)}%
        ${started}/${total} chunks
      `
    }

    let progressElements = []
    options.onChunkStart = ({contentLength, id}) => {
      if (!progressElements[id] && id !== undefined) {
        const progress = document.createElement('progress')
        progress.value = 0
        progress.max = 100

        const button = document.createElement('button')
        button.type = 'button'
        button.innerText = `Retry`
        button.classList.add('retry-button')
        button.onclick = () => {
          multiThread.retryRangeById(id)
        }

        chunkProgressArea.appendChild(progress)
        chunkProgressArea.appendChild(button)

        progressElements[id] = {
          progress: progress,
          button: button
        }
      }
    }

    options.onChunkFinish = ({contentLength, id}) => {
      progressElements[id].button.innerText = 'Done'
      progressElements[id].button.setAttribute('disabled', true)
    }

    options.onChunkProgress = ({contentLength, loaded, id}) => {
      if (!progressElements[id]) {
        options.onChunkStart({id, contentLength})
      } else {
        // handle divide-by-zero edge case when Content-Length=0
        const percent = contentLength ? loaded / contentLength : 1
        progressElements[id].progress.value = Math.round(percent * 100)
      }
    }

    options.url = new URL(`https://f${options.clusterNum}.backblazeb2.com/file/${options.bucketName}/${options.fileName}`)

    const multiThread = new MultiThread(options)
  }
})()
