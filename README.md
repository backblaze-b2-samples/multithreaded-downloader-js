# MultiThreadedDownloader

A browser based multi-threaded downloader implemented in vanilla JavaScript.

-   Sends HTTP HEAD request to get the file info
-   Calculate number of ranges and setup
-   Sends HTTP GET requests with "Range: bytes=start-end" header for each chunk
-   Monitor the progress of each response stream
-   Retry on fail or specific HTTP status codes (like 503 Service Unavailable)
-   Concatenates each response stream (in order) into a final output stream
-   Uses [StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js) to simplify downloading the output stream.
-   100% client side JavaScript, no plug-ins or proxy required

This project is under development and still has some bugs.

[Demos](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/)

## Backblaze B2

If using the B2 command line tool, remember to escape JSON with single quotes.
The B2 bucket must be "Public" and have the following CORS rules applied:
```
    [{
      "corsRuleName": "someName",
      "allowedOrigins": [
        "*"
      ],
      "allowedOperations": [
        "b2_download_file_by_id",
        "b2_download_file_by_name"
      ],
      "allowedHeaders": [
        "*"
      ],
      "exposeHeaders": [
        "Access-Control-Allow-Origin",
        "Content-Length"
      ],
      "maxAgeSeconds": 10240
    }]
```

## Usage
```
let options = {
  threads:    // Number of concurrent request threads
  rangeSize:  // Size of each range in MB
  retryDelay: // Delay before another retry attempt in ms
  retries:    // Number of retry attempts
  retryOn:    // Comma separated  list of HTTP status codes that trigger a retry
  headers:    // Request headers to pass-though
  fileName:   // The final output fileName
}

// onProgress and onFinish callbacks are optional
let multiThread = new MultiThread(options, onProgress, onFinish)

// Mimics global fetch()
multiThread.fetch(url, init)

// Stops everything
multiThread.cancel()
```

The onProgress callback function should accept a single object containing the chunk id, the chunk length in bytes, and the number of bytes loaded so far.
```
onProgress ({id, contentLength, loaded}) {
  ...
}
```

### Goals:

Fetches parts of a file using the HTTP Range header and downloads those pieces in parallel. When the pieces have all been downloaded, the original file is re-assembled and saved in the browser's Downloads folder.

-   The downloader should fetch the file directly from the web browser. No server will be needed to proxy the file.
-   The download process should not need any client software to be installed. Nor will a browser plugin be required.
-   This project shall allow for resuming an interrupted download, or at least retrying a part of the file that was interrupted.
-   Optionally, this project will allow us to specify the number of download threads and the size of each request... so we can tune it for specific network conditions, if that is necessary.

#### Dependencies
-   [Web Streams Polyfill](https://github.com/creatorrr/web-streams-polyfill)
-   [StreamSaver](https://github.com/jimmywarting/StreamSaver.js)

#### Reference/Other
-   [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
-   [Web Streams Spec](https://streams.spec.whatwg.org/)
-   [Parallel chunk requests in a browser via Service Workers](https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f)
-   [browser-server](https://github.com/mafintosh/browser-server)
-   [fetch-retry](https://github.com/jonbern/fetch-retry)
-   [Pipes.js](http://pipes.js.org/)
