(() => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js')
    navigator.serviceWorker.ready.then(reg => {
      // navigator.serviceWorker.addEventListener('message', event => {
      //   console.log(event)
      // })
      // window.fetch('https://f000.backblazeb2.com/file/nilayp/5GB.txt', {
      window.fetch('https://f000.backblazeb2.com/file/nilayp/uploads-smallmedium.tar.gz', { mode: 'no-cors' })
        .then(response => { console.log(response) })
    })
  }
})()
