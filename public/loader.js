console.log("----LOADING----");

var LOADED = {
	images:{}
};

var LOADER = {
	filePrefix:"",
	fileInfo:null,
	loadedFiles:{},
	cachedVersions:localStorage.getItem("cached-files")
};

var filePrefix = '';
var fileInfo = null;
begin();

function begin() {
	if(typeof(Storage) !== "undefined") {
		console.log('Web Storage supported!');
	} else {
		alert ('Your browser does not support Web Storage.');
		return;
	}
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onload = onGetFileInfo;
	xmlhttp.open("GET", filePrefix+"version/mmoo.txt", true);
	xmlhttp.send();
	console.log("Retrieving file information.");
}

function onGetFileInfo () {
	if (this.status == 200) {
		fileInfo = JSON.parse(this.responseText);
		loadFiles();
	} else {
		alert("Unable to retrieve file information from the server.");
	}
}

function loadFiles() {
	if (LOADER.cachedVersions != null) {
		LOADER.cachedVersions = JSON.parse(LOADER.cachedVersions);
	} else {
		console.log("No files cached");
		LOADER.cachedVersions = {};
	}

	var files = fileInfo.info;
	for (var i = 0; i < files.length; i++) {
		var name = files[i][0];
		var type = files[i][1];
		var version = files[i][2];
		var needLoad = true;

		LOADER.loadedFiles[name] = null;

		if (name in LOADER.cachedVersions) {
			if (LOADER.cachedVersions[name] == version) {
				//file already up to date
				needLoad = false
				LOADER.loadedFiles[name] = localStorage.getItem(name);
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
			req.props = {name:name, type:type, version:version};
			req.onload = onLoadFile;
			if (type.substring(0,5) == "image") {
				req.responseType = "arraybuffer";
			}
			req.send();
		}
	}
	onFileReady();
}

function onLoadFile() {
	if (this.status != 200) {
		alert("Unable to retrieve file '" + name + "' status " + this.status);
		return;
	}

	var name = this.props.name;
	var type = this.props.type;
	var version = this.props.version;

	if (type.substring(0,5) == "image") {
		var blob = new Blob([this.response], {type:type});
		fileReader = new FileReader();
		fileReader.props = this.props;
		fileReader.onload = onReadFile;
		fileReader.readAsDataURL(blob);
	} else {
		file = this.responseText;
		localStorage.setItem(name, file);
		LOADER.loadedFiles[name] = file;
		LOADER.cachedVersions[name] = version;
		console.log(name + ' downloaded and cached');
		onFileReady();
	}


}

function onReadFile(event) {
	var name = this.props.name;
	var type = this.props.type;
	var version = this.props.version;

	var result = event.target.result;
	localStorage.setItem(name, result);
	LOADER.loadedFiles[name] = result;
	LOADER.cachedVersions[name] = version;
	console.log(name + ' downloaded and cached');
	onFileReady();
}

function onFileReady() {
	var done = true;
	for (filename in LOADER.loadedFiles) {
		if (LOADER.loadedFiles[filename] == null) {
			done = false;
			break;
		}
	}

	if (done) {
		console.log("All files loaded!");
		//update local version numbers
		localStorage.setItem("cached-files", JSON.stringify(LOADER.cachedVersions));
		
		var images = fileInfo.images;
		for (var i = 0; i < images.length; i++) {
			var imagename = images[i];
			var image = new Image();
			image.src = LOADER.loadedFiles[imagename];
			LOADED.images[imagename] = image;
		}
		
		var scripts = fileInfo.scripts;
		for (var i = 0; i < scripts.length; i++) {
			eval(LOADER.loadedFiles[scripts[i]]);
		}
	}
}
