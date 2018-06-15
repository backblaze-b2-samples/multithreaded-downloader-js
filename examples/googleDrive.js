(() => {
  const ui = document.getElementById('ui')
  const chunkSizeInput = document.getElementById('chunkSize')
  const threadsInput = document.getElementById('threads')
  const retryDelayInput = document.getElementById('retryDelay')
  const retriesInput = document.getElementById('retries')
  const retryOnInput = document.getElementById('retryOn')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const signinButton = document.getElementById('signin-button')
  const signoutButton = document.getElementById('signout-button')
  const notificationArea = document.getElementById('notificationArea')
  const mainProgressArea = document.getElementById('mainProgressArea')
  const chunkProgressArea = document.getElementById('chunkProgressArea')
  const notification = document.createElement('blockquote')

  // On load, called to load the auth2 library and API client library.
  window.handleClientLoad = () => {
    gapi.load('client:auth2', () => {
      // Initializes the API client library and sets up sign-in state listeners.
      gapi.client.init({
        // API key and Client ID from the Developer Console
        apiKey: 'AIzaSyAKw_2a4rEjTTZpkbrDbvk4OZtHc_vhf_I',
        clientId: '186863027086-1lq5ls2ctq2o39dgfpoajig13qim5jcm.apps.googleusercontent.com',
        // Array of API discovery doc URLs for APIs used
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        // Authorization scopes required by the API
        scope: 'https://www.googleapis.com/auth/drive'
      }).then(() => {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus)

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get())

        signinButton.onclick = () => {
          gapi.auth2.getAuthInstance().signIn()
        }

        signoutButton.onclick = () => {
          gapi.auth2.getAuthInstance().signOut()
        }
      })
    })
  }

  // Called when the signed in status changes, to update the UI appropriately.
  function updateSigninStatus (isSignedIn) {
    if (isSignedIn) {
      signinButton.style.display = 'none'
      signoutButton.style.display = 'block'
      ui.style.display = 'block'
      listFiles()
    } else {
      signinButton.style.display = 'block'
      signoutButton.style.display = 'none'
      ui.style.display = 'none'
    }
  }

  function addOption (value, text) {
    let option = document.createElement('option')
    option.value = value
    option.innerText = text

    fileList.appendChild(option)
  }

  function listFiles () {
    gapi.client.drive.files.list({fields: 'files(id, name, size)'}).then((response) => {
      let files = response.result.files
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          let file = files[i]
          if (file.size) {
            addOption(file.id, `${file.name}`)
          }
        }

        downloadButton.onclick = startDownload
      } else {
        addOption(null, 'No files found.')
      }
    })
  }

  function startDownload () {
    let index = fileList.options.selectedIndex
    if (index > 0) {
      const fileID = fileList.options[index].value
      const fileName = fileList.options[index].innerText
      const threads = parseInt(threadsInput.value)
      const chunkSize = util.mbToBytes(parseInt(chunkSizeInput.value))
      const retries = parseInt(retriesInput.value)
      const retryDelay = parseInt(retryDelayInput.value)
      const retryOn = retryOnInput.value.split(',').map(code => parseInt(code))

      downloadFile({fileID, threads, chunkSize, retries, retryDelay, retryOn, fileName})
    }
  }

  function downloadFile (options) {
    // https://developers.google.com/drive/v3/web/manage-downloads
    // https://developers.google.com/api-client-library/javascript/features/cors
    const user = gapi.auth2.getAuthInstance().currentUser.get()
    const accessToken = user.getAuthResponse().access_token
    options.headers = new window.Headers({'Authorization': `Bearer ${accessToken}`})

    // Remove any previous children in the DOM from previous downloads
    util.removeAllChildren(notificationArea)
    util.removeAllChildren(mainProgressArea)
    util.removeAllChildren(chunkProgressArea)

    // Change download button into cancel button
    downloadButton.innerText = 'Cancel'
    downloadButton.onclick = () => {
      downloadButton.innerText = 'Download'
      downloadButton.onclick = startDownload
      multiThread.cancel()
    }

    // Main callbacks
    options.onStart = ({contentLength, chunks}) => {
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
      downloadButton.onclick = startDownload
    }

    // Individual range callbacks
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

    options.onChunkProgress = ({contentLength, loaded, id}) => {
      if (!progressElements[id]) {
        options.onChunkStart({contentLength, id})
      } else {
        // handle divide-by-zero edge case when Content-Length=0
        const percent = contentLength ? loaded / contentLength : 1
        progressElements[id].progress.value = Math.round(percent * 100)
      }
    }

    options.onChunkFinish = ({contentLength, id}) => {
      progressElements[id].button.innerText = 'Done'
      progressElements[id].button.setAttribute('disabled', true)
    }

    options.url = new URL(`https://www.googleapis.com/drive/v3/files/${options.fileID}?alt=media`)

    const multiThread = new MultiThread(options)
  }
})()
