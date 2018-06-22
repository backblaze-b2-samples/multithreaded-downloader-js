(function(FileSystem) {
	'use strict';

	function time(func, iters) {
		if (!iters) {
			iters = 2000;
		}

		var start = Date.now();
		var promises = new Array(iters);
		for (var i = 0; i < iters; i++) {
			promises.push(func());
		}

		return Promise.all(promises).then(function() {
			return Date.now() - start;
		});
	}

	// time by using fs.root
	time(function() {
		var fs = new FileSystem();
		fs.getRoot().then(function(root) {
			return root.readEntries();
		})
		.then(function(entries) {
			return entries;
		});
	}).then(function(time) {
		console.log('File entry retrieval using FileSystem.prototype.getRoot:' + time);
	});

	// time by using resolveLocalFileSystemURL
	time(function() {
		var fs = new FileSystem();
		fs.getURL('/').then(function(root) {
			return root.readEntries();
		})
		.then(function(entries) {
			return entries;
		});
	}).then(function(time) {
		console.log('File entry retrieval using FileSystem.prototype.getURL(\'/\'):' + time);
	});

})(window.FileSystem)