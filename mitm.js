// "man in the middle"
// This is only meant to signal the opener's messageChannel to the service worker
// when that is done this mitm can be closed
// The service worker is capable of intercepting all requests and returning their
// own "fake" responses When the worker receives a stream, it will tell the
// opener to create a link that will start the download

// don't want the opener to do a random timeout
// instead they can listen for the ready event
window.onmessage = event => {
  let {data, ports} = event

  // check for messageChannel, don't interfere with other simultaneous downloads
  if (!ports || !ports.length) {
    throw new TypeError("You didn't send a messageChannel")
  }

  // Register the worker, then forward the dataChannel to the worker so they
  // can talk directly and we don't have to be "the middle man" any longer
  navigator.serviceWorker.register('srvcwrkr.js', {scope: 'example.html'})
  navigator.serviceWorker.ready.then(registration => {
    // This sends the message data as well as transferring messageChannel.port2
    // to the service worker. The service worker can then use the transferred
    // port to reply via postMessage(), which will in turn trigger the onmessage
    // handler on messageChannel.port1.
    let registrationTmp = registration.installing || registration.waiting

    if (registration.active) {
      return registration.active.postMessage(data, [ports[0]])
    }

    registrationTmp.onstatechange = () => {
      if (registrationTmp.state === 'activated') {
        registration.active.postMessage(data, [ports[0]])
      }
    }
  })

  // Register the worker, then forward the dataChannel to the worker so they
  // can talk directly and we don't have to be "the middle man" any longer
  // navigator.serviceWorker.getRegistration('./example.html').then(registration => {
  //   return registration || navigator.serviceWorker.register('srvcwrkr.js', {scope: './example.html'})
  // }).then(registration => {
  //    This sends the message data as well as transferring
  //    messageChannel.port2 to the service worker. The service worker can
  //    then use the transferred port to reply via postMessage(), which
  //    will in turn trigger the onmessage handler on messageChannel.port1.
  //   let registrationTmp = registration.installing || registration.waiting
  //
  //   if (registration.active) {
  //     return registration.active.postMessage(data, [ports[0]])
  //   }
  //
  //   registrationTmp.onstatechange = () => {
  //     if (registrationTmp.state === 'activated') {
  //       registration.active.postMessage(data, [ports[0]])
  //     }
  //   }
  // })
}

// The opener can't listen to onload event, so we need to help em out!
// (telling them that we are ready to accept postMessage's)
window.opener && window.opener.postMessage('MultiStreamSaver::mitmLoaded', '*')
