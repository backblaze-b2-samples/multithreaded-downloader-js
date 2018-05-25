# MultiThreadedDownloader

A browser based multi-threaded downloader implemented in vanilla JavaScript.

[Project Demo Page](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/)

Fetches parts of a file using the HTTP Range header and downloads those pieces in parallel. When the pieces have all been downloaded, the original file is reassembled and saved in the browser's Downloads folder.

-   100% client side JavaScript, no plug-ins or proxy required
-   Sends a HTTP HEAD request to get the file's content-length
-   Sends multiple HTTP GET requests with range headers
-   Concatenates range response streams into a single stream
-   Concatenated stream is downloaded as a Blob object with [a\[download\]](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download)
-   Retry on fail or specific HTTP status codes (like 503 Service Unavailable)

This project is under development.

### Backblaze B2

If using with Backblaze B2, the bucket must be "Public" and have these CORS rules applied:
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

If using the command line tool, remember to escape JSON with single quotes like so:
```
'[{"corsRuleName": "someName","allowedOrigins": ["*"],"allowedOperations": ["b2_download_file_by_id", "b2_download_file_by_name"],"allowedHeaders": ["*"],"exposeHeaders": ["Access-Control-Allow-Origin", "Content-Length"],"maxAgeSeconds": 10240}]'
```

### Usage
The constructor accepts url string and an options object containing:
-   fileName: the fileName to save as
-   retries: number of retry attempts
-   retryDelay: delay in ms before another attempt
-   retryOn: array of HTTP status codes that will trigger a retry
-   reqType: either "chunkSize" or "threads"
-   headers: request headers pass-though <small><em>(useful for Google Drive Authorization)</em></small>
-   controller: an AbortController object <small><em>(to cancel downloads)</em></small>
-   chunkSize: size of each chunk in mb <small><em>(ignored if reqType is "threads")</em></small>
-   threads: number of request threads <small><em>(ignored if reqType is "chunkSize")</em></small>

### Goals:

-   The downloader should fetch the file directly from the web browser. No server will be needed to proxy the file.
-   The download process should not need any client software to be installed. Nor will a browser plugin be required.
-   This project shall allow for resuming an interrupted download, or at least retrying a part of the file that was interrupted.
-   Optionally, this project will allow us to specify the number of download threads and the size of each request... so we can tune it for specific network conditions, if that is necessary.

### Further ideas:

-   Transform stream to concatenate ArrayBuffers?
-   Pipe stream directly to the file without [a\[download\]](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download)?


-   [Parallel chunk requests in a browser via Service Workers](https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f)
-   [Web Streams Polyfill](https://github.com/creatorrr/web-streams-polyfill)
-   [StreamSaver](https://github.com/jimmywarting/StreamSaver.js)
-   [fetch-retry](https://github.com/jonbern/fetch-retry)
