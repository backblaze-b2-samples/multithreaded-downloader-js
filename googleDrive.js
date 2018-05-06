// let psd = new ParallelStreamingDownloader()

// !psd.supported() && console.error('Either ReadableStream or WritableStream is not supported!')

// API key and Client ID from the Developer Console
const API_KEY = 'AIzaSyAKw_2a4rEjTTZpkbrDbvk4OZtHc_vhf_I'
const CLIENT_ID = '186863027086-1lq5ls2ctq2o39dgfpoajig13qim5jcm.apps.googleusercontent.com'

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']

// Authorization scopes required by the API multiple scopes can be included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive'

let authorizeButton = document.getElementById('authorize-button')
let signoutButton = document.getElementById('signout-button')

let url = 'https://www.googleapis.com/drive/v3/files/'
let fileID = '0B7GSorgsgZvbRFpnNHBud0hQN3M'
let ACCESS_TOKEN = ''

if (navigator.serviceWorker) {
  navigator.serviceWorker.register('/sw.js')
}

// On load, called to load the auth2 library and API client library.
function handleClientLoad () {
  gapi.load('client:auth2', () => {
    // Initializes the API client library and sets up sign-in state listeners.
    gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES
    }).then(() => {
      // Listen for sign-in state changes.
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus)

      // https://developers.google.com/api-client-library/javascript/features/cors
      let user = gapi.auth2.getAuthInstance().currentUser.get()
      ACCESS_TOKEN = user.getAuthResponse().access_token

      // Handle the initial sign-in state.
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get())
      authorizeButton.onclick = handleAuthClick
      signoutButton.onclick = handleSignoutClick
    })
  })
}

// Called when the signed in status changes, to update the UI appropriately. After a sign-in, the API is called.
function updateSigninStatus (isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none'
    signoutButton.style.display = 'block'
    // listFiles()
    downloadFile(fileID)
  } else {
    authorizeButton.style.display = 'block'
    signoutButton.style.display = 'none'
  }
}

// Sign in the user upon button click.
function handleAuthClick (event) {
  gapi.auth2.getAuthInstance().signIn()
}

// Sign out the user upon button click.
function handleSignoutClick (event) {
  gapi.auth2.getAuthInstance().signOut()
}

function downloadFile (fileID) {
  // Here we could just simply open the link and then let
  // the SW add Content-Disposition header to that request.
  window.fetch(`${url}${fileID}?alt=media`, {
    headers: new window.Headers({
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    })
  }).then(res => res.body)
    .then(body => {
      console.log(body)
      // let fileStream = psd.createWriteStream(`${fileID}.txt`)
      // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
      // body.pipeTo(fileStream)

      // https://jakearchibald.com/2016/streams-ftw/ - The body is a stream :)
      // let reader = body.getReader()
      // let writer = fileStream.getWriter()

      // Write one chunk and get the next one OR stop writing and close the stream
      // let pump = () => reader.read().then(
      //   res => !res.done
      //     ? writer.write(res.value).then(pump)
      //     : writer.close()
      // )
      //
      // pump()
    })
}

// .then(blob => {
//   let fileStream = multiStreamSaver.createWriteStream(fileName)
//
//   https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo
//   response.pipeTo(fileStream)
//   return blob.pipeTo(fileStream)
//   console.log(blob)
//
//   let writer = fileStream.getWriter()
//   Close the stream so we stop writing OR write one chunk, then get the next one
//   let pump = () => reader.read().then(
//     res => res.done
//       ? writer.close()
//       : writer.write(res.value).then(pump))
//
//   pump()
// })


function appendPre (message) {
  var pre = document.getElementById('content')
  var textContent = document.createTextNode(message + '\n')
  pre.appendChild(textContent)
}

function listFiles () {
  gapi.client.drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)'
  }).then((response) => {
    appendPre('Files:')
    let files = response.result.files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        let file = files[i]
        appendPre(file.name + ' (' + file.id + ')')
      }
    } else {
      appendPre('No files found.')
    }
  })
}
