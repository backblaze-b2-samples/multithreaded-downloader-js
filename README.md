# javascript-multithreaded-downloader
A browser based multithreaded downloader implemented in vanilla Javascript.

This project is under development.

Fetches parts of a file using the HTTP Range header and downloads those pieces in parallel. When the pieces have all been downloaded, the original file is reassembled and saved in the browser's Downloads folder. [Project Page](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/)

* 100% client side JavaScript, no plugins or proxy required
* Service worker intercepts all fetch requests with a "threads" url parameter
* Sends a HTTP HEAD request to get the file's content-length
* Sends multiple HTTP GET requests with range headers
* Concatenates range responses into a single response
* Respose triggers download with [a[download]](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download)
* Retry on fail or specific HTTP status codes (like 503 Service Unavailable)

* Accepted url parameters:
  - threads: number of concurrent requests to use
  - retries: number of time to retry this request
  - retryDelay: ms delay before a retry
  - retryOn: array of HTTP status codes that will specifically trigger a retry
    ie: "?threads=8&retries=3&retryDelay=1000&retryOn=503"

* More research is needed:
  - Transform stream to concatenate ArrayBuffers?
  - Saving stream directly to the filesystem?

* Demo
  - [BackBlaze B2](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/backBlaze.html)
  - [Google Drive](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/googleDrive.html)


* Based on:
  - [fetch-retry](https://github.com/jonbern/fetch-retry)
  - [fetch-progress-indicators](https://github.com/AnthumChris/fetch-progress-indicators)
  - [StreamSaver](https://github.com/jimmywarting/StreamSaver.js)
  - [Web Streams Polyfill](https://github.com/creatorrr/web-streams-polyfill)
  - [Parallel chunk requests in a browser via Service Workers](https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f)


  Goals of this project are:
  * The downloader should fetch the file directly from the web browser. No server will be needed to proxy the file.
  * The download process should not need any client software to be installed. Nor will a browser plugin be required.
  * This project shall allow for resuming an interrupted download, or at least retrying a part of the file that was interrupted.
  * Optionally, this project will allow us to specify the number of download threads and the size of each request... so we can tune it for specific network conditions, if that is necessary.
