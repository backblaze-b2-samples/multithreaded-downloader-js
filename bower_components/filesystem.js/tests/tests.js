(function(FileSystem) {

	function logError(error) {
		ok(false, "Error has occurred: " + error);
		start();
	}

	asyncTest("FileSystem initialization", function() {
		expect(3);

		var minimum_size = 1024*1024*30,
			type = window.PERSISTENT;

		var fs = new FileSystem(minimum_size, window.PERSISTENT);
		fs.then(function(localfs) {
			equal(fs.fs, localfs, "The browser FileSystem instance has been cached.");
			equal(fs.type, type, "The proper type of filesystem has been loaded.");

			navigator.webkitPersistentStorage.queryUsageAndQuota(function(usage, quota) {
				equal(quota, minimum_size, "The filesystem has the proper minimum size.");
				start();
			});
		}, logError);
	});


	asyncTest("Loading root directory", function() {
		expect(1);

		var fs = new FileSystem();
		var local_root = null;
		fs.then(function(localfs) {
			local_root = localfs.root;
			return fs.getRoot();
		}).then(function(root) {
			equal(local_root.toURL(), root.toURL(), "The proper root has been loaded");
			start();
		}).catch(logError);

	});


	asyncTest("Make a directory and query it with getURL", function() {
		expect(3);

		var fs = new FileSystem(1024*1024, window.TEMPORARY);
		fs.getRoot().then(function(root) {
			return root.makeDirectory('foo');
		}).then(function(directory) {
			ok(directory.__modified__, "Promisified directory marker found.");
			ok(!!~directory.name.indexOf('foo'), "Proper file name for directory.")
			return fs.getURL('/foo');
		}).then(function(directory) {
			ok(!!~directory.name.indexOf('foo'), "Directory query success.");
			start();
		}).catch(logError);
	});


	asyncTest("Make a directory and remove it recursively", function() {
		expect(1);

		var fs = new FileSystem(1024*1024, window.TEMPORARY);
		fs.getRoot().then(function(root) {
			return root.makeDirectory('foo');
		}).then(function(directory) {
			return directory.removeRecursively();
		}).then(function() {
			return fs.getURL('/foo').then(function() {
				ok(false, "Directory still available");
				start();
			}, function(error) {
				ok(true, "Directory removed.")
				start();
			})
		}).catch(logError);
	})


	asyncTest("Load a subdirectory of root with getDirectory", function() {
		expect(1);

		var root = null;

		var fs = new FileSystem(1024*1024, window.TEMPORARY);
		fs.getRoot().then(function() {
			root = arguments[0];
			return root.makeDirectory('foo');
		}).then(function() {
			return root.getDirectory('foo');
		}).then(function(directory) {
			ok(!!~directory.name.indexOf('foo'), "Directory accessed");
			start();
		}).catch(logError);;
	});


	asyncTest("Make a file entry and query it with getURL", function() {
		expect(3);
		var fs = new FileSystem(1024*1024, window.TEMPORARY);
		fs.getRoot().then(function(root) {
			return root.makeFileEntry('bar.txt');
		}).then(function(entry) {
			ok(entry.__modified__, "Promisified file marker found.");
			ok(!!~entry.name.indexOf('bar.txt'), "Proper file name for file.")
			return fs.getURL('/bar.txt');
		}).then(function(entry) {
			ok(!!~entry.name.indexOf('bar.txt'), "File query success.")
			start();
		}).catch(logError);
	});


	asyncTest("Load a file in root with getFile", function() {
		expect(1);

		var root = null;

		var fs = new FileSystem(1024*1024, window.TEMPORARY);
		fs.getRoot().then(function() {
			root = arguments[0];
			return root.makeFileEntry('bar.txt');
		}).then(function() {
			return root.getFileEntry('bar.txt');
		}).then(function(entry) {
			ok(!!~entry.name.indexOf('bar.txt'), "File query success.")
			start();
		}).catch(logError);
	});


	// TODO: add test for directory.readEntries
	// TODO: add Entry interface tests
	// TODO: add FileEntry interface tests
	// TODO: add File prototype tests


})(window.FileSystem);