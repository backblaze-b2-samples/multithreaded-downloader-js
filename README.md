# MultiThreadedDownloader

A browser based multi-threaded downloader implemented in vanilla JavaScript.

[Project Demo Page](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/)

Fetches parts of a file using the HTTP Range header and downloads those pieces in parallel. When the pieces have all been downloaded, the original file is reassembled and saved in the browser's Downloads folder.

-   100% client side JavaScript, no plug-ins or proxy required
-   ~~Service worker intercepts all fetch requests with a "threads" url parameter~~<br/>
    MultiThreadedDownloader sets up and handles all requests from it's constructor.
-   Sends a HTTP HEAD request to get the file's content-length
-   Sends multiple HTTP GET requests with range headers
-   Concatenates range responses into a single response
-   Concatenated response triggers download with [a\[download\]](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download)
-   Retry on fail or specific HTTP status codes (like 503 Service Unavailable)

This project is under development.

### constructor parameters:

-   threads: number of concurrent requests to use
-   retries: number of times to attempt this request
-   retryDelay: delay in milliseconds before another attempt
-   retryOn: array of HTTP status codes that will specifically trigger a retry

### Backblaze B2

The B2 bucket must have these CORS rules:
```
        [{
          "corsRuleName": "someName",
          "allowedOrigins": ["*"],
          "allowedOperations": ["b2_download_file_by_id", "b2_download_file_by_name"],
          "allowedHeaders": ["*"],
          "exposeHeaders": ["Access-Control-Allow-Origin", "Content-Length"],
          "maxAgeSeconds": 10240
        }]
```

If using the command line tool, remember to escape JSON with single quotes:
```
        '[{"corsRuleName": "someName","allowedOrigins": ["*"],"allowedOperations": ["b2_download_file_by_id", "b2_download_file_by_name"],"allowedHeaders": ["*"],"exposeHeaders": ["Access-Control-Allow-Origin", "Content-Length"],"maxAgeSeconds": 10240}]'
```

### Todo:

-   Transform stream to concatenate ArrayBuffers?
-   Saving stream directly to the filesystem?

### Goals:

-   The downloader should fetch the file directly from the web browser. No server will be needed to proxy the file.
-   The download process should not need any client software to be installed. Nor will a browser plugin be required.
-   This project shall allow for resuming an interrupted download, or at least retrying a part of the file that was interrupted.
-   Optionally, this project will allow us to specify the number of download threads and the size of each request... so we can tune it for specific network conditions, if that is necessary.

### Thanks:

-   [fetch-retry](https://github.com/jonbern/fetch-retry)
-   [fetch-progress-indicators](https://github.com/AnthumChris/fetch-progress-indicators)
-   [StreamSaver](https://github.com/jimmywarting/StreamSaver.js)
-   [Web Streams Polyfill](https://github.com/creatorrr/web-streams-polyfill)
-   [Parallel chunk requests in a browser via Service Workers](https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f)
