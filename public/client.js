var socketURL = 'http://kevinstuff.net';
var socketPort = 8999;
var imgPrefix = 'http://kevinstuff.net/img/';

var socket;
var canvas = document.getElementById("gameview");
canvas.setAttribute("tabindex", 0);
var context = canvas.getContext("2d");
context.fillStyle = "#FF0000";

console.log(document.body.clientWidth);
console.log(document.getElementById('logouter').offsetWidth);

var canvasWidth;
var canvasHeight;
setCanvasSize();

document.oncontextmenu = function () {return false;};
document.onclick = function(e) {e.preventDefault(); e.defaultPrevented = true; e.stopPropagation(); return false;};
window.onresize = setCanvasSize;

var nextTick;
var TICK_LEN = 33;

var messages = [];
var gameStep = -2;
var lastMessage = -1;
var advanceStep = 0;
var waitSteps = 0;
var pingOut = false;
var deltas = [];

var keys = new Object();
var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (var i = 0; i < 26; i++) {
	keys[alphabet.charAt(i)] = i+65;
}
keys['SHIFT'] = 16;
keys['CRTL'] = 17;
keys['ALT'] = 18;
keys['LEFT'] = 37;
keys['UP'] = 38;
keys['RIGHT'] = 39;
keys['DOWN'] = 40;

var pressed = [];
for (key in keys) {
	pressed[keys[key]] = false;
}

var images = LOADED.images;

var MOUSE_DRAG_MIN = 5;
var mouseCoords;
var mouseDownCoords;
var mouseIsDown = false;
var mouseDragging = false;

var camera = [0,0];
var CAMERA_SPEED = 20;

var entities = new Object();
var particles = [];
var buttons = [];

var ownSelected = 0;

var HIGHLIGHT = 0;
var HP = 1;
var DAMAGE = 2;
var COLOUR_SELF = [[0,255,0], [0,180,0], [200,255,200]];
var COLOUR_FRIENDLY = [[0,0,255], [0,0,180], [200,200,255]];
var COLOUR_NEUTRAL = [[255,255,0], [180,180,0], [255,255,200]];
var COLOUR_HOSTILE = [[255,0,0], [180,0,0], [255,200,200]];

/*function imageLoaded () {
	var str = this.src.substring(imgPrefix.length);
	images[str][0] = true;
	chatLog(str);
	numLoaded++;
	if (numLoaded == imageList.length) {
		gameStep = -1;
		openConnection();
	}
}*/

function loadImages() {
	console.log('loading images');
	imgs = {'img/man.jpg':'http://kevinstuff.net/img/man.jpg', 'img/bear.jpg':'http://kevinstuff.net/img/bear.jpg'};
	for (imgname in imgs) {
		var image = new Image();
		image.imgname = imgname;
		image.onload = function() {
			images[this.imgname] = this;
		}
		image.src = imgs[imgname];
	}
}

function openConnection() {
	socket = io.connect(socketURL, {port: socketPort, transports: ["websocket"]});
	socket.on("connect", onConnect);
	socket.on("disconnect", onDisconnect);
	socket.on("message", onMessage);
}

function startGame() {
	clearChat();
	
	buttons.push({	coords:[24,24], 
		action:'red',
		colour:'rgba(255,0,0,1.0)'
	});
	buttons.push({	coords:[72,24], 
		action:'green',
		colour:'rgba(0,255,0,1.0)'
	});
	buttons.push({	coords:[120,24], 
		action:'yellow',
		colour:'rgba(255,255,0,1.0)'
	});
	
	canvas.addEventListener('mousedown', onMouseDown, false);
	canvas.addEventListener('mouseup', onMouseUp, false);
	canvas.addEventListener('mousemove', onMouseMove, false);
	canvas.addEventListener('keydown', onKeyDown, false);
	canvas.addEventListener('keyup', onKeyUp, false);
}

function sendChat(e) {
	if (e.keyCode == 13) {
	    var field = document.getElementById('chat');
	    socket.send(JSON.stringify(['chat', field.value]));
	    field.value='';
	    return false;
	}
}

//NOTE
//do not modify indeces of coordinates
//coords variables get passed around a lot
//just make a new one
//the cost of making a new size-2 list is trivial

function chatLog(text){
    var box = document.getElementById('log');
    box.innerHTML = box.innerHTML + text + '<br>';
    box.scrollTop = box.scrollHeight;
}
function clearChat() {
	var box = document.getElementById('log');
    box.innerHTML = '';
    box.scrollTop = box.scrollHeight;
}

function onConnect () {
	console.log('Connected to server');
}

function onDisconnect () {
	console.log('Disconnected from server');
}

function pingSend() {
	socket.send(JSON.stringify(['ping']));
}

function onMessage (data) {
	console.log(data);
	var msg = JSON.parse(data);
	
	if (gameStep < 0) {
		gameStep = msg[0]-10;
		lastMessage = gameStep;
		startGame();
		return;
	}
	var delta = msg[0] - gameStep;
	if (deltas.length >= 10) {
		deltas.shift();
	}
	deltas.push(Math.abs(delta));
	
	if (delta < 0) {
		//message arrived late, need to set gameStep back
		var avg = 0;
		for (var i = 0; i < deltas.length; i++) {
			avg += deltas[i];
		}
		avg /= deltas.length;
		advanceStep = 0;
		var back = Math.floor(avg*2) + 1;
		var histLen = gameStep - lastMessage;
		var wait = back-histLen;
		
		if (back <= histLen) {
			rollBack(back);
		} else {
			rollBack(histLen);
			waitSteps = wait;
			console.log('WAIT ' + waitSteps);
		}
	} else if (delta == 0) {
		advanceStep = 0;
	} else {
		advanceStep += delta/50;
	}
	
	if (msg[1] == 'ping') {
		lastMessage = msg[0];
		pingOut = false;
	} else if (msg[1] == 'chat') {
		chatLog(msg[2]);
	} else {
		messages.push(msg);
	}
}

function readMessage(msg) {
	//this is only called if the step matches, so step can be discarded
	msg.shift();
	lastMessage = gameStep;
	
	if (msg[0] == 'move' || msg[0] == 'atk') {
		//id = msg[1];
		//coords = msg[2];
		//dest = msg[3]
		setEntityCoords(msg[1], msg[2]);
		entities[msg[1]].order = [msg[0], msg[3]];
	} else if (msg[0] == 'stop') {
		setEntityCoords(msg[1], msg[2]);
		entities[msg[1]].order = ['stop'];
	} else if (msg[0] == 'see') {
		//id = msg[1]
		//control = msg[2]
		//coords = msg[3]
		//sprite = msg[4]
		//stats = msg[5]
		entities[msg[1]] = {control:msg[2], coords:msg[3], nextcoords:msg[3], sprite:msg[4],
							stats:msg[5], selected:false, order:['stop']};
	} else if (msg[0] == 'unsee') {
		//id = msg[1]
		var entity = entities[msg[1]];
		if (entity.selected && entity.control == 0) {
			ownSelected--;
		}
		delete entities[msg[1]];
	} else if (msg[0] == 'control') {
		//id = msg[1]
		//control = msg[2] 0 = controlled, 1 = friend, 2 = neutral, 3 = hostile
		entities[msg[1]].control = msg[2];
	} else if (msg[0] == 'stat') {
		//id = msg[1]
		//vals = msg[2]
		//	{stat:val, stat:val}
		var id = msg[1];
		var vals = msg[2];
		for (key in vals) {
			if (key == 'hp') {
				damageEntity(id,vals[key]);
			} else {
				id.stats[key] = vals[key];
			}
		}
	}
}

function onMouseDown(e) {
	fixWhich(e);
	
	var canvasX = canvas.offsetLeft;
	var canvasY = canvas.offsetTop;
	
	var x = e.clientX - canvasX;
	var y = e.clientY - canvasY;
	
	if (e.which == 1) {
		//left mouse
		mouseDownCoords = [x,y];
		mouseIsDown = true;
	}
}

function onMouseUp(e) {
	fixWhich(e);
	
	if (e.which == 1) {
		//left mouse up
		if (mouseDragging) {
			leftClickDrag();
		} else {
			leftClick();
		}
		mouseIsDown = false;
		mouseDragging = false;
	} else if (e.which == 3) {
		rightClick();
	}
}

function onMouseMove (e) {
	fixWhich(e);
	var canvasX = canvas.offsetLeft;
	var canvasY = canvas.offsetTop;
	mouseCoords = [e.clientX-canvasX, e.clientY-canvasY];
	
	if (mouseIsDown) {
		if (Math.abs(mouseCoords[0]-mouseDownCoords[0]) > MOUSE_DRAG_MIN || Math.abs(mouseCoords[1]-mouseDownCoords[1]) > MOUSE_DRAG_MIN) {
			mouseDragging = true;
		}
	}
}

function onKeyDown (e) {
	pressed[e.keyCode] = true;
}

function onKeyUp (e) {
	pressed[e.keyCode] = false;
}

function fixWhich(e) {
  if (!e.which && e.button) {
    if (e.button & 1) e.which = 1      // Left
    else if (e.button & 4) e.which = 2 // Middle
    else if (e.button & 2) e.which = 3 // Right
  }
}


function leftClick() {
	var up = mouseCoords;
	for (var i = 0; i < buttons.length; i++) {
		if (inRect(up, buttons[i].coords, 48, 48)) {
			socket.send(JSON.stringify(['but',buttons[i].action]));
			return;
		}
	}
	
	up = viewToWorld(mouseCoords);
	var s = pressed[keys['SHIFT']];
	
	if (!s) {
		for (id in entities) {
			entities[id].selected = false;
			if (entities[id].control == 0) {
				ownSelected--;
			}
		}
	}
	
	var entity;
	for (id in entities) {
		entity = entities[id];
		if (inRect(up, entity.coords, 48, 48)) {
			if (entity.control != 0 && ownSelected != 0) {
				continue;
			}
			entity.selected = true;
			if (entities[id].control == 0) {
				ownSelected++;
			}
			if (!s) {
				break;
			}
		}
	}
}

function leftClickDrag() {
	//rearrange such that up is top left, down is bottom right
	var down = viewToWorld([mouseDownCoords[0], mouseDownCoords[1]]);
	var up = viewToWorld([mouseCoords[0], mouseCoords[1]]);
	fixRectCorners(down, up);
	
	for (id in entities) {
		var entity = entities[id];
		if (!pressed[keys['SHIFT']]) {
			entity.selected = false;
			if (entities[id].control == 0) {
				ownSelected--;
			}	
		}
		if (entity.control == 0) {
			if ((up[0] <= entity.coords[0] && entity.coords[0] <= down[0])
				&&(up[1] <= entity.coords[1] && entity.coords[1] <= down[1])) {
				entity.selected = true;
				if (entities[id].control == 0) {
					ownSelected++;
				}
			}
		}
	}
}

function rightClick() {
	var up = viewToWorld(mouseCoords);
	var dest = ''
	var order = 'move';
	
	for (id in entities) {
		var entity = entities[id];
		if (inRect(up, entity.coords, 48, 48)) {
			dest = id;
			if (entity.control != 0) {
				order = 'atk';
			}
			break;
		}
	}
	
	if (dest == '') {
		dest = [Math.round(up[0]), Math.round(up[1])];
	}
	
	for (id in entities) {
		var entity = entities[id];
		if (entity.selected && entity.control == 0) {
			var msg = JSON.stringify([order, id, dest, pressed[keys['SHIFT']]]);
			socket.send(msg);
		}
	}
}

function damageEntity(id, amount) {
	entity = entities[id];
	var hp0 = entity.stats.hp;
	entity.stats.hp -= amount;
	if (entity.stats.hp < 0) {
		entity.stats.hp = 0;
	}
	var hp1 = entity.stats.hp;
	var dmgratio = parseFloat(hp0-hp1)/entity.stats.maxhp;
	var hpratio = parseFloat(entity.stats.hp)/entity.stats.maxhp;
	x = -27 + Math.floor(hpratio*54);
	y = 24;
	width = Math.ceil(dmgratio*54);
	height = 5;
	var colour;
	switch (entities[id].control) {
		case 0: colour = COLOUR_SELF[DAMAGE]; break;
		case 1: colour = COLOUR_FRIENDLY[DAMAGE]; break;
		case 2: colour = COLOUR_NEUTRAL[DAMAGE]; break;
		case 3: colour = COLOUR_HOSTILE[DAMAGE];
	}
	particles.push({attach:id, x:x, y:y, width:width, height:height, colour:colour, life:15, lifetime:15});
}

function setEntityCoords(id, coords) {
	entity = entities[id];
	entity.coords = coords;
	entity.nextcoords = coords;
}

function onTick() {
	if (gameStep == -2) {
		//loading screen
		context.clearRect(0,0,canvasWidth, canvasHeight);
		context.fillStyle = "rgba(50,50,50,1.0)";
		context.fillRect(canvasWidth/4, canvasHeight/2-15, canvasWidth/2, 30);
		var w = canvasHeight/2-6;
		var w2 = Math.ceil(w * (numLoaded/imageList.length));
		context.fillStyle = rgbaString(COLOUR_SELF[HP],1.0);
		context.fillRect(canvasWidth/4+3, canvasHeight/2-12, w2, 24);
		setTick();
		return;
	} else if (gameStep == -1) {
		//menu
		setTick();
		return;
	}

	if (gameStep - lastMessage > 30 && !pingOut) {
		pingSend();
		pingOut = true;
	}
	
	if (waitSteps > 0) {
		waitSteps--;
	} else {
		gameLogic();
		if (advanceStep >= 1) {
			advanceStep--;
			console.log("ADVANCE");
			gameLogic();
		}
	}
	
	if (pressed[keys['UP']]) {
		camera[1] -= CAMERA_SPEED;
	}
	if (pressed[keys['DOWN']]) {
		camera[1] += CAMERA_SPEED;
	}
	if (pressed[keys['LEFT']]) {
		camera[0] -= CAMERA_SPEED;
	}
	if (pressed[keys['RIGHT']]) {
		camera[0] += CAMERA_SPEED;
	}
	
	nextTick += TICK_LEN;
	setTick();
}

function gameLogic() {
	gameStep++;

	for (id in entities) {
		entities[id].coords = entities[id].nextcoords;
	}

	while (messages.length > 0) {
		if (gameStep < messages[0][0]) {
			break;
		}
		readMessage(messages.shift());
	}

	var entity;
	for (id in entities) {
		entity = entities[id];
		
		if (gameStep == lastMessage) {
			entity.history = [];
		}
		entity.history.push(entity.coords);
		
		//temporary, no animations yet so attack basically means stop
		if (entity.order[0] != 'move') {
			continue;
		}
		
		var dest;
		//if (Object.prototype.toString.call(entity.order[1]) === '[object Array]') {
		if (entity.order[1] instanceof Array) {
			dest = entity.order[1];
		} else {
			//destination is an entity
			if (!(entity.order[1] in entities)) {
				continue;
			}
			//naive approach: move directly toward it
			dest = entities[entity.order[1]].coords;
		}
		
		if (LinAlg.pointDist(entity.coords, dest) <= entity.stats.spd) {
			entity.nextcoords = dest;
			entity.dest = entity.nextcoords;
		} else {
			angle = LinAlg.pointAngle(entity.coords, dest);
			entity.nextcoords = LinAlg.pointOffset(entity.coords, angle, entity.stats.spd);
		}
	}
}

function drawFrame() {
	var drawTime = new Date().getTime();
	var tickProgress = 1 - ((nextTick-drawTime) / TICK_LEN);
	
	if (tickProgress < 0) {
		console.log('(' + nextTick + ' - ' + drawTime + ') / ' + TICK_LEN + ' = ' + tickProgress);
		tickProgress = 0;
	} else if (tickProgress > 1) {
		console.log('(' + nextTick + ' - ' + drawTime + ') / ' + TICK_LEN + ' = ' + tickProgress);
		tickProgress = 1;
	}

	context.clearRect(0,0,canvasWidth, canvasHeight);

	//entities
	for (id in entities) {
		var entity = entities[id];
		var coords = entity.coords;
		var nextcoords = entity.nextcoords;

		if (coords == nextcoords) {
			entity.drawcoords = worldToView(coords);
		} else {
			var angle = LinAlg.pointAngle(coords, nextcoords);
			var dist = LinAlg.pointDist(coords, nextcoords) * tickProgress;
			entity.drawcoords = worldToView(LinAlg.pointOffset(coords, angle, dist));
		}

		drawEntity(entity);
	}
	
	//selection circles and health bars (want these always on top of entities)
	for (id in entities) {
		var coords = entities[id].drawcoords;

		if (entities[id].selected) {
			switch (entities[id].control) {
				case 0: context.strokeStyle = rgbaString(COLOUR_SELF[HIGHLIGHT],1.0); break;
				case 1: context.strokeStyle = rgbaString(COLOUR_FRIENDLY[HIGHLIGHT],1.0); break;
				case 2: context.strokeStyle = rgbaString(COLOUR_NEUTRAL[HIGHLIGHT],1.0); break;
				case 3: context.strokeStyle = rgbaString(COLOUR_HOSTILE[HIGHLIGHT],1.0);
			}
			context.beginPath();
			context.arc(coords[0], coords[1], 24, 0, 2*Math.PI);
			context.stroke();
		}
		context.fillStyle = "rgba(50,50,50,1.0)";
		context.fillRect(coords[0]-28, coords[1]+23, 56, 7);
		switch (entities[id].control) {
			case 0: context.fillStyle = rgbaString(COLOUR_SELF[HP],1.0); break;
			case 1: context.fillStyle = rgbaString(COLOUR_FRIENDLY[HP],1.0); break;
			case 2: context.fillStyle = rgbaString(COLOUR_NEUTRAL[HP],1.0); break;
			case 3: context.fillStyle = rgbaString(COLOUR_HOSTILE[HP],1.0);
		}
		var ratio = parseFloat(entities[id].stats.hp)/entities[id].stats.maxhp;
		context.fillRect(coords[0]-27, coords[1]+24, Math.floor(ratio*54), 5);
	}
	
	//health bar effects
	var i = 0;
	while (i < particles.length) {
		var p = particles[i];
		if (!(p.attach in entities)) {
			particles.splice(i,1);
			continue;
		}
		context.fillStyle = "rgba(" + p.colour[0] + "," + p.colour[1] + "," + p.colour[2] + "," +
							parseFloat(p.life)/p.lifetime + ")";
		var coords = entities[p.attach].drawcoords;
		context.fillRect(coords[0]+p.x, coords[1]+p.y, p.width, p.height);
		p.life--;
		if (p.life == 0) {
			particles.splice(i,1);
		} else {
			i++;
		}
	}
	
	//selection rectangle
	if (mouseDragging) {
		context.strokeStyle = "rgba(0,255,0,1.0)";
		var down = [mouseDownCoords[0], mouseDownCoords[1]];
		var up = [mouseCoords[0], mouseCoords[1]];
		fixRectCorners(down,up);
		context.strokeRect(down[0], down[1], up[0]-down[0], up[1]-down[1]);
	}
	
	//buttons
	for (var i = 0; i < buttons.length; i++) {
		context.fillStyle = buttons[i].colour;
		context.fillRect(buttons[i].coords[0]-24, buttons[i].coords[1]-24, 48,48);
	}

	//FPS
	var thisDraw = new Date().getTime();
	var fps = Math.round(1000 / (thisDraw - lastDraw));
	lastDraw = thisDraw;

	context.fillStyle = '#000000';
	context.font = '14px Arial';
	context.fillText(fps, canvasWidth-50, 25);

	window.requestAnimationFrame(drawFrame);
}

function setTick() {
	var wait = nextTick - new Date().getTime();
	if (wait < 0) {
		wait = 0;
	}
	setTimeout(onTick,wait);
}

function rollBack(steps) {
	console.log('ROLL BACK ' + steps);
	var which;
	var entity;
	for (id in entities) {
		entity = entities[id];
		which = entity.history.length-steps-1; //if this throws exceptions, it's the fault of the caller
		entity.coords = entity.history[which];
		entity.history = [];
	}
	gameStep -= steps;
}

function drawEntity (entity) {
	var coords = entity.drawcoords;
	var sprite = 'img/' + entity.sprite + '.jpg';
	if (sprite in images) {
		//image exists, draw that
		context.drawImage(images[sprite], coords[0]-24, coords[1]-24);
	} else {
		//draw a rectangle
		context.fillStyle = "rgba(100,100,100,1.0)";
		context.fillRect(Math.round(coords[0])-24, Math.round(coords[1])-24, 48, 48);
	}
};

function rgbaString (rgb, a) {
	return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
}

//rearranges two rectangle corners such that TL is top left and BR is bottom right
//obviously, calling it on already correct coords is a waste of time
function fixRectCorners(TL,BR) {
	var dX = TL[0]-BR[0];
	var dY = TL[1]-BR[1];
	if (dX < 0) {
		BR[0] += dX;
		TL[0] -= dX;
	}
	if (dY < 0) {
		BR[1] += dY;
		TL[1] -= dY;
	}
}

function randRange (minimum, maximum) {
	return Math.floor(Math.random()*maximum)+minimum;
}

function inRect(point, coords,width,height) {
	return (Math.abs(point[0]-coords[0]) < width/2 && Math.abs(point[1]-coords[1]) < height/2);
}

function viewToWorld(coords) {
	return [coords[0]+camera[0], coords[1]+camera[1]];
}

function worldToView(coords) {
	return [coords[0]-camera[0], coords[1]-camera[1]];
}

function setCanvasSize() {
	var outer = document.getElementById('gameouter');
	canvasWidth = outer.clientWidth;
	canvasHeight = outer.clientHeight;
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
}

function getScrollbarWidth() {
    var outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.width = "100px";
    document.body.appendChild(outer);

    var widthNoScroll = outer.offsetWidth;
    // force scrollbars
    outer.style.overflow = "scroll";

    // add innerdiv
    var inner = document.createElement("div");
    inner.style.width = "100%";
    outer.appendChild(inner);        

    var widthWithScroll = inner.offsetWidth;

    // remove divs
    outer.parentNode.removeChild(outer);

    return widthNoScroll - widthWithScroll;
}

//loadImages();

gameStep = -1;
nextTick = new Date().getTime()+TICK_LEN;
onTick();
var lastDraw = nextTick;
window.requestAnimationFrame(drawFrame);

openConnection();
