(() => {
  const threadsInput = document.getElementById('threads')
  const chunkSizeInput = document.getElementById('chunkSize')
  const retriesInput = document.getElementById('retries')
  const retryDelayInput = document.getElementById('retryDelay')
  const retryOnInput = document.getElementById('retryOn')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const notificationArea = document.getElementById('notificationArea')
  const progressArea = document.getElementById('progressArea')

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

      downloadFile({clusterNum, bucketName, threads, chunkSize, retries, retryDelay, retryOn, fileName})
    }
  }

  function downloadFile (options) {
    // Remove any children in the DOM from previous downloads
    util.removeAllChildren(notificationArea)
    util.removeAllChildren(progressArea)

    // Change "Download" button text & function to "Cancel"
    downloadButton.innerText = 'Cancel'
    downloadButton.onclick = () => {
      multiThread.cancel()
      // Switch back to download again
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
    }

    let totalChunks = 0
    const notification = document.createElement('blockquote')

    options.onStart = ({contentLength, chunks}) => {
      notificationArea.appendChild(notification)
      totalChunks = chunks
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
        ${started}/${totalChunks} chunks`
    }

    options.onError = ({error}) => {
      // notification.classList.add('error')
      console.warn(error)
    }

    let progressElements = []

    options.onChunkStart = ({id}) => {
      if (id && !progressElements[id]) {
        const progress = document.createElement('progress')
        progress.value = 0
        progress.max = 100

        const info = document.createElement('span')
        info.classList.add('waiting')
        info.innerText = id

        const container = document.createElement('div')
        container.classList.add('container')
        container.appendChild(progress)
        container.appendChild(info)
        progressArea.appendChild(container)

        progressElements[id] = {container, progress, info}
      }
    }

    options.onChunkFinish = ({contentLength, id}) => {
      progressElements[id].info.classList.remove('error')
      progressElements[id].info.classList.remove('progress')
      progressElements[id].info.classList.remove('waiting')
      progressElements[id].info.classList.add('success')
    }

    options.onChunkProgress = ({contentLength, loaded, id}) => {
      if (!progressElements[id]) {
        options.onChunkStart({id, contentLength})
      } else {
        // handle divide-by-zero edge case when Content-Length=0
        const percent = contentLength ? loaded / contentLength : 1
        progressElements[id].progress.value = Math.round(percent * 100)
        progressElements[id].info.classList.remove('error')
        progressElements[id].info.classList.remove('success')
        progressElements[id].info.classList.remove('waiting')
        progressElements[id].info.classList.add('progress')
      }
    }

    options.onChunkError = ({error, id}) => {
      progressElements[id].info.classList.remove('progress')
      progressElements[id].info.classList.remove('success')
      progressElements[id].info.classList.remove('waiting')
      progressElements[id].info.classList.add('error')
      console.warn(`Chunk ${id}:`, error)
    }

    options.url = new URL(`https://f${options.clusterNum}.backblazeb2.com/file/${options.bucketName}/${options.fileName}`)

    const multiThread = new MultiThread(options)
  }
})()
