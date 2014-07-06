var filePrefix = '';
var fileInfo = null;
var xmlhttp = new XMLHttpRequest();
begin();

function begin() {
	if(typeof(Storage) !== "undefined") {
		console.log('Web Storage supported!');
	} else {
		alert ('Your browser does not support Web Storage.');
		return;
	}

	xmlhttp.onload = onGetFileInfo;
	xmlhttp.open("GET", filePrefix+"version/mmoo.txt", true);
	xmlhttp.send();
	console.log("Retrieving file information.");
}

function onGetFileInfo () {
	if (xmlhttp.status == 200) {
		fileInfo = JSON.parse(xmlhttp.responseText);
		loadFiles();
	} else {
		alert("Unable to retrieve file information from the server.");
	}
}

function loadFiles() {
	var cachedVersions = localStorage.getItem("cached-files");
	var loadedFiles = {};
	if (cachedVersions != null) {
		cachedVersions = JSON.parse(cachedVersions);
	} else {
		console.log("No files cached");
		cachedVersions = {};
	}

	var files = fileInfo.info;
	for (var i = 0; i < files.length; i++) {
		var name = files[i][0];
		var type = files[i][1];
		var version = files[i][2];
		var needLoad = true;

		loadedFiles[name] = null;

		if (name in cachedVersions) {
			if (cachedVersions[name] == version) {
				//file already up to date
				needLoad = false
				loadedFiles[name] = localStorage.getItem(name);
				console.log(name + ' is already up to date.');
			} else {
				console.log(name + ' is not up to date.');
			}
		} else {
			console.log(name + ' is not cached.');
		}

		if (needLoad) {
			//http request the script, and store it
			var req = new XMLHttpRequest();
			req.open("GET", filePrefix+name, true);
			req.props = {name:name, type:type, version:version, loadedFiles:loadedFiles, cachedVersions:cachedVersions};
			req.onload = onLoadFile;
			if (type.substring(0,5) == "image") {
				req.responseType = "arraybuffer";
			}
			req.send();
		}
	}

	//update local version numbers
	localStorage.setItem("cached-files", JSON.stringify(cachedVersions));
}

function onLoadFile() {
	if (this.status != 200) {
		alert("Unable to retrieve file '" + name + "' status " + this.status);
		return;
	}

	var name = this.props.name;
	var type = this.props.type;
	var version = this.props.version;
	var loadedFiles = this.props.loadedFiles;
	var cachedVersions = this.props.cachedVersions;

	if (type.substring(0,5) == "image") {
		var blob = new Blob([this.response], {type:type});
		fileReader = new FileReader();
		fileReader.props = this.props;
		fileReader.onload = onReadFile;
		fileReader.readAsDataURL(blob);
	} else {
		file = req.responseText;
		localStorage.setItem(name, file);
		loadedFiles[name] = file;
		cachedVersions[name] = version;
		console.log(name + ' downloaded and cached');
	}


}

function onReadFile(event) {
	var name = this.props.name;
	var type = this.props.type;
	var version = this.props.version;
	var loadedFiles = this.props.loadedFiles;
	var cachedVersions = this.props.cachedVersions;

	var result = event.target.result;
	localStorage.setItem(name, result);
	loadedFiles[name] = result;
	cachedVersions[name] = version;
	console.log(name + ' downloaded and cached');
}

function onFileReady(loadedFiles) {
	var done = true;
	for (filename in loadedFiles) {
		if (loadedFiles[filename] == null) {
			done = false;
			break;
		}
	}

	if (done) {
		console.log("All files loaded!");
	}
}