console.log("----LOADING----");

var LOADED = {
	images:{}
};

var LOADER = {
	filePrefix:"",
	fileInfo:null,
	loadDiv:document.createElement('div'),
	loadedFiles:{},
	cachedVersions:localStorage.getItem("cached-files")
};

document.getElementsByTagName('body')[0].appendChild(LOADER.loadDiv);

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
	xmlhttp.open("GET", LOADER.filePrefix+"version/mmoo.txt?t="+new Date().getTime(), true);
	xmlhttp.send();
	console.log("Retrieving file information.");
}

function onGetFileInfo () {
	if (this.status == 200) {
		LOADER.fileInfo = JSON.parse(this.responseText);
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

	var files = LOADER.fileInfo.info;
	for (var i = 0; i < files.length; i++) {
		var name = files[i][0];
		var type = files[i][1];
		var version = files[i][2];
		var needLoad = true;
		var loadItem = document.createElement('div');
		loadItem.setAttribute('id', name);
		loadItem.innerHTML = name + '<br>';

		LOADER.loadedFiles[name] = null;

		if (name in LOADER.cachedVersions) {
			if (LOADER.cachedVersions[name] == version) {
				//file already up to date
				loadItem.setAttribute('class', 'loaded');
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
			loadItem.setAttribute('class', 'loading');
		
			//http request the script, and store it
			var req = new XMLHttpRequest();
			req.open("GET", LOADER.filePrefix+name+'?t='+new Date().getTime(), true);
			req.props = {name:name, type:type, version:version};
			req.onload = onLoadFile;
			if (type.substring(0,5) == "image") {
				req.responseType = "arraybuffer";
			}
			req.send();
		}
		
		LOADER.loadDiv.appendChild(loadItem);
	}
	onFileReady('');
}

function onLoadFile() {
	if (this.status != 200) {
		alert("Unable to retrieve file '" + this.props.name + "' status " + this.status);
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
		onFileReady(name);
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
	onFileReady(name);
}

function onFileReady(name) {
	if (name != '') {
		document.getElementById(name).setAttribute('class', 'loaded');
	}

	var done = true;
	for (filename in LOADER.loadedFiles) {
		if (LOADER.loadedFiles[filename] == null) {
			done = false;
			break;
		}
	}

	if (done) {
		console.log("All files loaded!");
		document.getElementsByTagName('body')[0].removeChild(LOADER.loadDiv);
		//update local version numbers
		localStorage.setItem("cached-files", JSON.stringify(LOADER.cachedVersions));
		
		var cssFiles = LOADER.fileInfo.css;
		for (var i = 0; i < cssFiles.length; i++) {
			var filename = cssFiles[i];
			var head = document.getElementsByTagName('head')[0];
			var style = document.createElement('style');
			style.type = "text/css";
			style.appendChild(document.createTextNode(LOADER.loadedFiles[filename]));
			head.appendChild(style);
		}
		
		var htmlFiles = LOADER.fileInfo.html;
		var aVeryLongString = '';
		for (var i = 0; i < htmlFiles.length; i++) {
			var filename = htmlFiles[i];
			aVeryLongString += LOADER.loadedFiles[filename];
		}
		document.getElementsByTagName('body')[0].innerHTML += aVeryLongString;
		
		var images = LOADER.fileInfo.images;
		for (var i = 0; i < images.length; i++) {
			var imagename = images[i];
			var image = new Image();
			image.src = LOADER.loadedFiles[imagename];
			LOADED.images[imagename] = image;
		}
		
		var jsFiles = LOADER.fileInfo.scripts;
		console.log(jsFiles);
		console.log(jsFiles.length);
		for (var i = 0; i < jsFiles.length; i++) {
			console.log('eval(' + jsFiles[i] + ')');
			try {
				eval(LOADER.loadedFiles[jsFiles[i]]);
			} catch (err) {
				console.log(err.message);
			}
		}
		console.log('eval complete');
	}
}
