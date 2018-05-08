(() => {
  navigator.serviceWorker.register('serviceWorker.js', {scope: location.href })
})()
