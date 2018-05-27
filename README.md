# MultiThreadedDownloader

A browser based multi-threaded downloader implemented in vanilla JavaScript.

[Demo Page](https://backblaze-b2-samples.github.io/multithreaded-downloader-js/)

Fetches parts of a file using the HTTP Range header and downloads those pieces in parallel. When the pieces have all been downloaded, the original file is re-assembled and saved in the browser's Downloads folder.

-   100% client side JavaScript, no plug-ins or proxy required
-   Sends a HTTP HEAD request to get the file's content-length
-   Sends HTTP Range requests for each chunk
-   Concatenates arrayBuffers from each response
-   Downloaded as a Blob object with [a\[download\]](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download)
-   Retry on fail or specific HTTP status codes (like 503 Service Unavailable)

This project is under development.

### Goals:

-   The downloader should fetch the file directly from the web browser. No server will be needed to proxy the file.
-   The download process should not need any client software to be installed. Nor will a browser plugin be required.
-   This project shall allow for resuming an interrupted download, or at least retrying a part of the file that was interrupted.
-   Optionally, this project will allow us to specify the number of download threads and the size of each request... so we can tune it for specific network conditions, if that is necessary.

## Backblaze B2

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

## Usage

The MultiThread() constructor accepts a url and an options object containing:
-   threads: Number of concurrent request threads
-   chunkSize: Size of each chunk in MB
-   retryDelay: Delay before another retry attempt in ms
-   retries: Number of retry attempts
-   retryOn: Comma separated  list of HTTP status codes that will trigger a retry
-   headers: Request headers pass-though <small><em>(useful for Google Drive Authorization)</em></small>
-   fileName: The fileName to save as

#### Dependencies
-   [Web Streams Polyfill](https://github.com/creatorrr/web-streams-polyfill)
-   [es6-promise-pool](https://github.com/timdp/es6-promise-pool)

#### Reference & Unanswered
-   [fetch-retry](https://github.com/jonbern/fetch-retry)
-   [StreamSaver](https://github.com/jimmywarting/StreamSaver.js)
-   [Parallel chunk requests in a browser via Service Workers](https://blog.ghaiklor.com/parallel-chunk-requests-in-a-browser-via-service-workers-7be10be2b75f)
-   Pipe streams directly to a file without [a\[download\]](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download)?
-   Use TransformStream to concatenate ArrayBuffers?
-   Memory usage with large downloads?
