(() => {
  const ui = document.getElementById('ui')
  const chunkSizeType = document.getElementById('chunkSizeType')
  const chunkSizeInput = document.getElementById('chunkSize')
  const threadsType = document.getElementById('threadsType')
  const threadsInput = document.getElementById('threads')
  const retryDelayInput = document.getElementById('retryDelay')
  const retriesInput = document.getElementById('retries')
  const fileList = document.getElementById('fileList')
  const downloadButton = document.getElementById('downloadButton')
  const cancelButton = document.getElementById('cancelButton')
  const signinButton = document.getElementById('signin-button')
  const signoutButton = document.getElementById('signout-button')
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

        downloadButton.onclick = (event) => {
          let index = fileList.options.selectedIndex
          if (index > 0) {
            const fileID = fileList.options[index].value
            const fileName = fileList.options[index].innerText
            const chunkSize = parseInt(chunkSizeInput.value)
            const threads = parseInt(threadsInput.value)
            const retryDelay = parseInt(retryDelayInput.value)
            const retries = parseInt(retriesInput.value)

            downloadFile({fileID, fileName, chunkSize, threads, retries, retryDelay, reqType})
          }
        }
      } else {
        addOption(null, 'No files found.')
      }
    })
  }

  function addOption (value, text) {
    let option = document.createElement('option')
    option.value = value
    option.innerText = text

    fileList.appendChild(option)
  }

  // https://developers.google.com/drive/v3/web/manage-downloads
  // https://developers.google.com/api-client-library/javascript/features/cors
  function downloadFile (options) {
    const user = gapi.auth2.getAuthInstance().currentUser.get()
    const accessToken = user.getAuthResponse().access_token

    options.controller = new AbortController()
    options.headers = new window.Headers({'Authorization': `Bearer ${accessToken}`})
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${options.fileID}?alt=media`)

    new MultiThreadedDownloader(url, options).then(() => {
      cancelButton.setAttribute('disabled', true)
      downloadButton.removeAttribute('disabled')
    })

    cancelButton.removeAttribute('disabled')
    downloadButton.setAttribute('disabled', true)
    cancelButton.onclick = () => {
      downloadButton.removeAttribute('disabled')
      cancelButton.setAttribute('disabled', true)
      options.controller.abort()
    }
  }
})()
