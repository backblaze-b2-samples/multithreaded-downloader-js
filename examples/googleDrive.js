(() => {
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

        let signinButton = document.getElementById('signin-button')
        signinButton.onclick = () => {
          gapi.auth2.getAuthInstance().signIn()
        }

        let signoutButton = document.getElementById('signout-button')
        signoutButton.onclick = () => {
          gapi.auth2.getAuthInstance().signOut()
        }
      })
    })
  }

  // Called when the signed in status changes, to update the UI appropriately. After a sign-in, the API is called.
  function updateSigninStatus (isSignedIn) {
    let signinButton = document.getElementById('signin-button')
    let signoutButton = document.getElementById('signout-button')
    let fileList = document.getElementById('GDFileList')
    if (isSignedIn) {
      signinButton.style.display = 'none'
      signoutButton.style.display = 'block'
      fileList.style.display = 'block'
      listFiles()
    } else {
      signinButton.style.display = 'block'
      signoutButton.style.display = 'none'
      fileList.style.display = 'none'
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

        const downloadButton = document.getElementById('GDDownload')
        downloadButton.onclick = (event) => {
          let fileList = document.getElementById('GDFileList')
          let index = fileList.options.selectedIndex
          let fileID = fileList.options[index].value
          let fileName = fileList.options[index].innerText
          if (index > 0) {
            downloadFile(fileID, fileName)
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

    let fileList = document.getElementById('GDFileList')
    fileList.appendChild(option)
  }

  // https://developers.google.com/drive/v3/web/manage-downloads
  function downloadFile (fileID, fileName) {
    // https://developers.google.com/api-client-library/javascript/features/cors
    const user = gapi.auth2.getAuthInstance().currentUser.get()
    const accessToken = user.getAuthResponse().access_token
    const headers = new window.Headers({'Authorization': `Bearer ${accessToken}`})
    const threads = parseInt(document.getElementById('GDThreads').value)
    const retries = parseInt(document.getElementById('GDRetries').value)
    const retryDelay = parseInt(document.getElementById('GDRetryDelay').value)
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileID}`)
    url.searchParams.set('alt', 'media')

    const downloader = new MultiThreadedDownloader(url, {headers, threads, retries, retryDelay})
      .then(() => {
        document.getElementById('GDCancel').setAttribute('disabled', true)
      })

    const cancelButton = document.getElementById('GDCancel')
    cancelButton.removeAttribute('disabled')
    cancelButton.onclick = event => {
      downloader.controller.abort()
      cancelButton.setAttribute('disabled', true)
    }
  }
})()
