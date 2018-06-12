(() => {
  const rangeSizeInput = document.getElementById('rangeSize')
  const threadsInput = document.getElementById('threads')
  const retryDelayInput = document.getElementById('retryDelay')
  const retriesInput = document.getElementById('retries')
  const retryOnInput = document.getElementById('retryOn')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const notificationArea = document.getElementById('notificationArea')
  const mainProgressArea = document.getElementById('mainProgressArea')
  const rangeProgressArea = document.getElementById('rangeProgressArea')
  const notification = document.createElement('blockquote')

  downloadButton.onclick = startDownload

  function startDownload () {
    const index = fileList.options.selectedIndex

    if (index > 0) {
      const clusterNum = fileList.options[index].dataset.clusterNum
      const bucketName = fileList.options[index].dataset.bucketName
      const threads = parseInt(threadsInput.value)
      const rangeSize = util.mbToBytes(parseInt(rangeSizeInput.value))
      const retries = parseInt(retriesInput.value)
      const retryDelay = parseInt(retryDelayInput.value)
      const retryOn = retryOnInput.value.split(',').map(code => parseInt(code))
      const fileName = fileList.options[index].value

      downloadButton.innerText = 'Cancel'
      downloadFile({clusterNum, bucketName, threads, rangeSize, retries, retryDelay, retryOn, fileName})
    }
  }

  function downloadFile (options) {
    // Remove any previous children in the DOM from previous downloads
    util.removeAllChildren(notificationArea)
    util.removeAllChildren(mainProgressArea)
    util.removeAllChildren(rangeProgressArea)

    // Change download button into cancel button
    downloadButton.innerText = 'Cancel'
    downloadButton.onclick = () => {
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
      multiThread.cancel()
    }

    // Main callbacks
    options.onStart = ({rangesTotal, contentLength}) => {
      notification.innerText = `Downloading ${util.bytesToMb(contentLength).toFixed(1)}mb`
      notificationArea.appendChild(notification)
    }

    options.onProgress = ({contentLength, loaded}) => {
      // handle divide-by-zero edge case when Content-Length=0
      const percent = contentLength ? loaded / contentLength : 1
      notification.innerText = `Downloading ${util.bytesToMb(loaded).toFixed(1)}/${util.bytesToMb(contentLength).toFixed(1)}mb, ${Math.round(percent * 100)}%`
    }

    options.onFinish = () => {
      notification.innerText = ` Download finished successfully!`
      downloadButton.innerText = 'Download'
    }

    // Individual range callbacks
    let progressElements = []

    options.onRangeStart = ({id, contentLength}) => {
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

        rangeProgressArea.appendChild(progress)
        rangeProgressArea.appendChild(button)

        progressElements[id] = {
          progress: progress,
          button: button
        }
      }
    }

    options.onRangeProgress = ({id, contentLength, loaded}) => {
      if (!progressElements[id]) {
        options.onRangeStart({id, contentLength})
      } else {
        // handle divide-by-zero edge case when Content-Length=0
        const percent = contentLength ? loaded / contentLength : 1
        progressElements[id].progress.value = Math.round(percent * 100)
      }
    }

    options.onRangeFinish = ({id, contentLength}) => {
      progressElements[id].button.innerText = 'Done'
      progressElements[id].button.setAttribute('disabled', true)
    }

    const multiThread = new MultiThread(options)
    const url = new URL(`https://f${options.clusterNum}.backblazeb2.com/file/${options.bucketName}/${options.fileName}`)
    multiThread.fetch(url, options)
  }
})()
