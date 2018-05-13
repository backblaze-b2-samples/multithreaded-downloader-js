(() => {
  // Pre register & setup service worker before demo pages load. Prevents
  // missing the 1st fetch event after service worker is installed.
  const mtd = new MultiThreadedDownloader()
})()
