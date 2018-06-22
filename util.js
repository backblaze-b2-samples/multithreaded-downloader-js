const util = {
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
