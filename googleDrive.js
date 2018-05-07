(() => {
  let mtd = new MultiThreadedDownloader()

  !mtd.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

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
        let fileList = document.getElementById('GDFileList')
        fileList.onclick = (event) => {
          let index = event.target.options.selectedIndex
          let fileID = event.target.options[index].value
          let fileName = event.target.options[index].innerText
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

  function downloadFile (fileID, fileName) {
    // https://developers.google.com/api-client-library/javascript/features/cors
    let user = gapi.auth2.getAuthInstance().currentUser.get()
    let accessToken = user.getAuthResponse().access_token

    // Add "intercept=true" parameter so service worker can intercept request
    window.fetch(`https://www.googleapis.com/drive/v3/files/${fileID}?alt=media&intercept=true`, {
      headers: new window.Headers({'Authorization': `Bearer ${accessToken}`})
    }).then(res => res.body).then(body => {
      let fileStream = mtd.createWriteStream(`${fileName}.txt`)

      // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
      let reader = body.getReader()
      // body.pipeTo(fileStream)

      // https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
      let writer = fileStream.getWriter()

      // Write one chunk and get the next one OR stop writing and close the stream
      let pump = () => reader.read().then(
        res => !res.done
          ? writer.write(res.value).then(pump)
          : writer.close())

      pump()
    })
  }
})()
