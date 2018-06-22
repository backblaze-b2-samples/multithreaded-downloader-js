# FileSystem.js
FileSystem.js is a Promise-based wrapper library for the HTML5 FileSystem API. It smooths over the rough edges of the existing [FileSystem](http://dev.w3.org/2009/dap/file-system/pub/FileSystem/) and [File](http://dev.w3.org/2006/webapi/FileAPI/) APIs and makes it simple to reason about its inherent asynchronicity. It uses native Promises since these have finally arrived in the stable version of Chrome.

## Supported Browsers
- Chrome

The FileSystem API is only available in Chrome at this time.

## Usage
First, create the FileSystem object.
`var fs = new FileSystem(minimum_size, type);`
By default, the minimum size (in bytes) will be 5Mb and the type will be persistent storage.

If you want to catch errors on the new filesystem object, it can be done as follows:
`fs.catch(onerrorfunction)`

### Examples
#### Getting the root directory
```javascript
fs.getRoot().then(function(root) {
	// do something with the root directory
})
```
#### Loading a filesystem url
```javascript
fs.getURL('[path]').then(function(entry) {
	// do something with the directory or file
})
```
#### Creating a directory
```javascript
fs.getRoot().then(function(root) {
	root.makeDirectory('somedir');
}).then(function(directory) {
	// do something with the created directory
})
```
#### Creating a file entry and writing to it in a directory
```javascript
fs.getURL('/somedir').then(function(directory) {
	return directory.makeFileEntry('somefile.txt');
}).then(function(fileEntry) {
	fileEntry.write(new Blob(['who are you?'],{ type: 'text/plaintext' }));
})
```
#### Read all the files in a directory
```javascript
fs.getRoot().then(function(root) {
	return root.readEntries();
}).then(function(entries) {
	// do something with the entries which have just been read
})
```
#### Read all of the ArrayBuffers for entries in a directory 
```javascript
fs.getRoot().then(function(root) {
	return root.readEntries();
}).then(function(entries) {
	var promises = [].map.call(entries, function(entry) {
		return entry.getFile().then(function(file) {
			return file.readAsArrayBuffer();
		});
	});

	return Promise.all(promises);
}).then(function(buffers) {
	// do something with the array buffers
})
```

## API
### FileSystem
```javascript
new FileSystem([minimumSize, type])
```
- Returns: a promise like object that wraps the filesystem.
- Parameters:
	- `minimumSize` - size in bytes for the browser file system (5MB by default).
	- `type` - either PERSISTENT or TEMPORARY (PERSISTENT by default).

```javascript
FileSystem.prototype.getRoot()
```
- Returns: a promise that will yield the DirectoryEntry for the root directory.

```javascript
FileSystem.prototype.getURL(url)
```
- Returns: a promise that will yield the Entry represented by the URL.
- Parameters:
	- `url` - the absolute URL that references an entry in the filesystem.

```javascript
FileSystem.prototype.getStatistics()
```
- Returns: a promise that will yield an object of the form `{ usage: [usage in bytes], allocated: [allocated space in bytes]}` when it completes.

```javascript
FileSystem.prototype.allocate(size)
```
- Returns: a promise that will yield the new filesystem size in bytes.
- Parameters:
	- `size` - the desired filesystem size in bytes.

```javascript
FileSystem.prototype.then(oncomplete, onerror)
```
- Returns: a promise that runs `oncomplete` when the filesystem is loaded, and `onerror` when an error occurs.
- Parameters:
	- `oncomplete(localfs)` - a function to run when load is complete.
		- `localfs` - an object representing the W3C FileSystem.
	- `onerror(error)` - a function to run when an error is thrown.
		- `error` - the error that was thrown.

```javascript
FileSystem.prototype.catch(onerror)
```
- Returns: a promise that runs `onerror` when an error occurs.
- Parameters:
	- `onerror(error)` - a function to run when an error is thrown.
		- `error` - the error that was thrown.

### Entry
```javascript
Entry.prototype.getMetadata()
```
- Returns: a promise that will yield an object of the form `{ modificationTime: [Date], size: [size in bytes] }` for the entry.

```javascript
Entry.prototype.moveTo(parent[, newName])
```
- Returns: a promise that will yield the moved entry when it completes.
- Parameters:
	- `parent` - DirectoryEntry to which the entry will be moved.
	- `newName` - new name for entry (optional).

```javascript
Entry.prototype.copyTo(parent[, newName])
```
- Returns: a promise that will yield the copied entry when it completes.
- Parameters:
	- `parent` - DirectoryEntry to which the entry will be copied.
	- `newName` - new name for entry (optional).

```javascript
Entry.prototype.getParent()
```
- Returns: a promise that will yield the parent directory when it completes.

```javascript
Entry.prototype.remove()
```
- Returns: a promise that yields nothing after the entry is removed.

### DirectoryEntry < Entry
```javascript
DirectoryEntry.prototype.getFileEntry(path[, options])
```
- Returns: a promise that yields the FileEntry.
- Parameters:
	- `path` - a string that represents the path to the FileEntry.
	- `options` - [see reference](http://dev.w3.org/2009/dap/file-system/pub/FileSystem/#widl-DirectoryEntry-getFile-void-DOMString-path-Flags-options-EntryCallback-successCallback-ErrorCallback-errorCallback).

```javascript
DirectoryEntry.prototype.makeFileEntry(path[, exclusive])
```
- Returns: a promise that yields the created FileEntry.
- Parameters:
	- `path` - a string that represents the path to the new FileEntry.
	- `exclusive` - if false, will overwrite an existing FileEntry with the same path; otherwise, will throw an error if a FileEntry with the same path exists.

```javascript
DirectoryEntry.prototype.getDirectoryEntry(path[, options])
```
- Returns: a promise that yields the DirectoryEntry.
- Parameters:
	- `path` - a string that represents the path to the DirectoryEntry.
	- `options` - [see reference](http://dev.w3.org/2009/dap/file-system/pub/FileSystem/#widl-DirectoryEntry-getFile-void-DOMString-path-Flags-options-EntryCallback-successCallback-ErrorCallback-errorCallback).

```javascript
DirectoryEntry.prototype.makeDirectoryEntry(path[, exclusive])
```
- Returns: a promise that yields the created DirectoryEntry.
- Parameters:
	- `path` - a string that represents the path to the new DirectoryEntry.
	- `exclusive` - if false, will overwrite an existing DirectoryEntry with the same path; otherwise, will throw an error if a DirectoryEntry with the same path exists.

```javascript
DirectoryEntry.prototype.removeRecursively()
```
- Returns: a promise that yields nothing after the DirectoryEntry is removed.

```javascript
DirectoryEntry.prototype.readEntries()
```
- Returns: a promise that yields an array of entries contained in the directory.

### FileEntry < Entry
```javascript
FileEntry.prototype.getFile()
```
- Returns: a promise that yields the File that the file entry stores.

```javascript
FileEntry.prototype.write(blob)
```
- Returns: a promise that yields the FileEntry that has been written to.
- Parameters:
	- `blob` - a Blob or File object to write to the FileEntry.

```javascript
FileEntry.prototype.createWriter()
```
- Returns: a promise that yields a FileWriter for writing to the underlying file. Allows for more granular control of writing, such as appending.

### File
```javascript
File.prototype.readAsDataURL()
```
- Returns: a promise that yields the data url for the File.

```javascript
File.prototype.readAsArrayBuffer()
```
- Returns: a promise that yields the array buffer for the File.

```javascript
File.prototype.readAsText()
```
- Returns: a promise that yields the string for the File.

## License MIT
Copyright (c) 2014 Kirill Klimuk

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.