const util = {
  fetchRetry (url, init) {
    const retries = init.retries || 2
    const retryDelay = init.retryDelay || 1000
    const retryOn = init.retryOn || [ 503 ]

    return new Promise((resolve, reject) => {
      function fetchAttempt (retriesRemaining) {
        fetch(url, init).then(response => {
          if (retryOn.indexOf(response.status) === -1) {
            resolve(response)
          } else {
            if (retriesRemaining > 0) {
              retry(retriesRemaining)
            } else {
              reject(response)
            }
          }
        }).catch(error => {
          console.error('fetchRetry: ', error)
          if (retryOn.indexOf(404) !== -1) {
            if (retriesRemaining > 0) {
              retry(retriesRemaining)
            } else {
              reject(error)
            }
          }
        })
      }

      function retry (retriesRemaining) {
        setTimeout(() => {
          fetchAttempt(--retriesRemaining)
        }, retryDelay)
      }

      fetchAttempt(retries)
    })
  },
  getContentLength (response) {
    // Google drive response headers are all lower case, B2's are not!
    return parseInt(response.headers.get('Content-Length') || response.headers.get('content-length'))
  },
  removeAllChildren (element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  },
  bytesToMb (bytes) {
    return bytes / 1048576
  },
  mbToBytes (mb) {
    return mb * 1048576
  }
}
