var QueryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    	// If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = pair[1];
    	// If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]], pair[1] ];
      query_string[pair[0]] = arr;
    	// If third or later entry with this name
    } else {
      query_string[pair[0]].push(pair[1]);
    }
  } 
    return query_string;
} ();
console.log(QueryString);

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
	if (typeof(Storage) !== "undefined") {
		console.log('Web Storage supported!');
	} else {
		alert ('Your browser does not support Web Storage.');
		return;
	}
	
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onload = onGetFileInfo;
	xmlhttp.open("GET", LOADER.filePrefix+"version/mmoo.txt?t="+new Date().getTime(), true);
	xmlhttp.overrideMimeType('text/plain');
	xmlhttp.send();
	console.log("Retrieving file information.");
}

function onGetFileInfo () {
	if (this.status == 200 || this.status == 0) {
		LOADER.fileInfo = JSON.parse(this.responseText);
		loadFiles();
	} else {
		alert("Unable to retrieve file information from the server. (" + this.status + ")");
	}
}

function loadFiles() {
	if (LOADER.cachedVersions != null) {
		if (QueryString.load == 'all') {
			console.log('Load it all!');
			LOADER.cachedVersions = {};
		} else {
			LOADER.cachedVersions = JSON.parse(LOADER.cachedVersions);
		}
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
		var docBody = document.getElementsByTagName('body')[0]
		docBody.removeChild(LOADER.loadDiv);
		
		//update local version numbers
		localStorage.setItem("cached-files", JSON.stringify(LOADER.cachedVersions));
		
		//apply CSS
		var filenames = LOADER.fileInfo.css;
		for (var i = 0; i < filenames.length; i++) {
			var filename = filenames[i];
			var head = document.getElementsByTagName('head')[0];
			var style = document.createElement('style');
			style.type = "text/css";
			style.appendChild(document.createTextNode(LOADER.loadedFiles[filename]));
			head.appendChild(style);
		}
		
		//add HTML
		filenames = LOADER.fileInfo.html;
		var htmlText = '';
		for (var i = 0; i < filenames.length; i++) {
			var filename = filenames[i];
			htmlText += LOADER.loadedFiles[filename];
		}
		docBody.innerHTML += htmlText;
		
		//make images easily accessible by other scripts
		filenames = LOADER.fileInfo.images;
		for (var i = 0; i < filenames.length; i++) {
			var filename = filenames[i];
			var image = new Image();
			image.src = LOADER.loadedFiles[filename];
			LOADED.images[filename.substring(4,filename.length)] = image;
		}
		
		//same for json
		filenames = LOADER.fileInfo.json;
		LOADED.json = {};
		for (var i = 0; i < filenames.length; i++) {
			var name = filenames[i];
			name = name.substring(5, name.length);
			LOADED.json[name] = LOADER.loadedFiles[filenames[i]];
		}
		
		//run scripts
		//eval is too restricted, need to use script tags
		filenames = LOADER.fileInfo.scripts;
		for (var i = 0; i < filenames.length; i++) {
			var element = document.createElement('script');
			element.setAttribute('id', filenames[i]);
			element.appendChild(document.createTextNode(LOADER.loadedFiles[filenames[i]]));
			docBody.appendChild(element);
		}
	}
}
