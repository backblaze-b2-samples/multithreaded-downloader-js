(() => {
  const threadsInput = document.getElementById('threads')
  const chunkSizeInput = document.getElementById('chunkSize')
  const retriesInput = document.getElementById('retries')
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
      const chunkSize = parseInt(chunkSizeInput.value) * 1024 * 1024
      const retries = parseInt(retriesInput.value)
      const fileName = fileList.options[index].value

      downloadFile({clusterNum, bucketName, threads, chunkSize, retries, fileName})
    }
  }

  function removeAllChildren (element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  function downloadFile (options) {
    // Remove any children in the DOM from previous downloads
    removeAllChildren(notificationArea)
    removeAllChildren(progressArea)

    // Change "Download" button text & function to "Cancel"
    downloadButton.innerText = 'Cancel'
    downloadButton.onclick = () => {
      multiThread.cancel()
      // Switch back to download again
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
    }

    let totalChunks = 0
    let progressElements = []
    const notification = document.createElement('blockquote')

    // These are the main "thread" handlers
    options.onStart = ({contentLength, chunks}) => {
      notificationArea.appendChild(notification)
      totalChunks = chunks
    }

    options.onFinish = () => {
      notification.innerText += '\nFinished successfully!'
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
    }

    options.onError = ({error}) => {
      console.error(error)
    }

    options.onProgress = ({contentLength, loaded}) => {
      const bytesToMb = bytes => {
        return bytes / 1024 / 1024
      }

      // handle divide-by-zero edge case when Content-Length=0
      const percent = contentLength ? loaded / contentLength : 1

      notification.innerText = `Downloading ${totalChunks} chunks
        ${bytesToMb(loaded).toFixed(1)}/${bytesToMb(contentLength).toFixed(1)} MB, ${Math.round(percent * 100)}%`
    }

    // These are the individual chunk handlers
    options.onChunkStart = ({id}) => {
      if (!progressElements[id]) {
        progressElements[id] = new Nanobar({target: progressArea})
        progressElements[id].el.children[0].classList.add('progress')
      } else {
        progressElements[id].el.children[0].classList.remove('error')
        progressElements[id].el.children[0].classList.add('waiting')
      }
    }

    options.onChunkFinish = ({id}) => {
      progressElements[id].el.children[0].classList.remove('error')
      progressElements[id].el.children[0].classList.remove('waiting')
      progressElements[id].el.children[0].classList.remove('progress')
      progressElements[id].el.children[0].classList.add('success')
    }

    options.onChunkError = ({id, error}) => {
      progressElements[id].el.children[0].classList.remove('waiting')
      progressElements[id].el.children[0].classList.remove('progress')
      progressElements[id].el.children[0].classList.add('error')
      console.warn(`Chunk ${id}:`, error)
    }

    options.onChunkProgress = ({contentLength, loaded, id}) => {
      if (!progressElements[id]) {
        options.onChunkStart({id})
      } else {
        if (progressElements[id].el.children[0].classList.contains('waiting')) {
          progressElements[id].el.children[0].classList.remove('waiting')
          progressElements[id].el.children[0].classList.add('progress')
        }

        // handle divide-by-zero edge case when Content-Length=0
        const percent = contentLength ? loaded / contentLength : 1
        progressElements[id].go(percent * 99.99)
      }
    }

    options.url = `https://f${options.clusterNum}.backblazeb2.com/file/${options.bucketName}/${options.fileName}`

    const multiThread = new MultiThread(options)
  }
})()
