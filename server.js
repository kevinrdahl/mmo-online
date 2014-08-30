var port = 8999;

var util = require('util');
var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({port: port});

var LinAlg;

try {
	LinAlg = require('./public/LinAlg');
} catch (err) {
	LinAlg = require('./public/script/LinAlg');
}

var clients = [];
var pendingClients = [];
var entities = {};

var entityNum = 0;
var clientNum = 0;
var gameStep = 100;
var stepTime = new Date().getTime();
var nextTick;
var TICK_LEN = 66;


addEntity(entityNum, 'bears', [400,300], 'bear', {spd:3, hp:300, maxhp:300, atktime:30});
entityNum++;

function broadcast(msg) {
	for (var i = 0; i < clients.length; i++) {
		clients[i].send(msg);
	}
}

wss.on('connection', function (socket) {
	var id = clientNum++;
	socket.id = id.toString();
	util.log('Client connected: ' + socket.id);
	
	socket.playerId = null;
	socket.onMessage = onPendingMessage;
	socket.onDisconnect = onPendingDisconnect;
	socket.on('message', function(data){this.onMessage(data);});
	socket.on('close', function(){this.onDisconnect();});
	pendingClients.push(socket);
	socket.send("[]");
});

function newClient (socket) {
}

function onPendingMessage(data) {
	util.log(this.id + ': ' + data);
	//client is attempting to log in
	var msg = JSON.parse(data);
	
	//for now ["login", name]
	if (msg.length == 2 && msg[0] == 'login') {
		login(this, msg[1]);
	}
}

function onPendingDisconnect() {
	util.log('Client disconnected: ' + this.id + ' (not logged in)');
	//remove from pending
	for (var i = 0; i < pendingClients.length; i++) {
		if (pendingClients[i].id == this.id) {
			pendingClients.splice(i,1);
			break;
		}
	}
}

function login (socket, playerId) {
	util.log('Client ' + socket.id + ' logged in as ' + playerId);
	socket.playerId = playerId;
	
	//remove from pending
	for (var i = 0; i < pendingClients.length; i++) {
		if (pendingClients[i].id == socket.id) {
			pendingClients.splice(i,1);
			break;
		}
	}
	
	//add to clients
	clients.push(socket);
	
	socket.onMessage = onMessage;
	socket.onDisconnect = onDisconnect;
	
	socket.send(JSON.stringify([gameStep, 'ping']));
	seeAll(socket);
}

function onMessage(data) {
	var msg = JSON.parse(data);
	
	//don't want these logged
	if (msg[0] == 'ping') {
		this.send(JSON.stringify([gameStep, 'ping']));
		return;
	} else if (msg[0] == 'time') {
		this.send(JSON.stringify([gameStep, 'time', stepTime]));
		return;
	}

	util.log(this.playerId + ': ' + data);
	
	if (msg[0] == 'move' || msg[0] == 'atk') {
		if (entities[msg[1]] == null) {
			return;
		}
		if (determineControl(this,entities[msg[1]]) != 0) {
			return;
		}
		
		if (msg[0] == 'move') {
			var offset;
			if (msg[2] instanceof Array) {
				offset = 0;
			} else {
				offset = 46;
			}
			addAction(msg[1], [msg[0], msg[2], offset], !msg[3]);
		} else {
			addAction(msg[1], [msg[0], msg[2]], !msg[3]);
		}
	} else if (msg[0] == 'chat' && msg.length == 2) {
		msg[1] = '<b>[' + this.playerId + ']</b>: ' + msg[1];
		data = JSON.stringify([gameStep, msg[0], msg[1]]);
		broadcast(data);
	} else if (msg[0] == 'but') {
		if (msg[1] == 'red') {
			addEntity(entityNum, 'bears', [400,300], 'bear', {spd:3, hp:300, maxhp:300, atktime:30});
		} else if (msg[1] == 'green') {
			addEntity(entityNum, this.playerId, [24,300], 'man', {spd:5, hp:100, maxhp:100, atktime:30});
		} else if (msg[1] == 'yellow') {
			addEntity(entityNum, 'neutral', [100,600], 'man', {spd:5, hp:100, maxhp:100, atktime:30});
		}
		
		entityNum++;
	}
}

function onDisconnect() {
	util.log('Client disconnected: ' + this.id + ' (' + this.playerId + ')');
	for (var i = 0; i < clients.length; i++) {
		if(clients[i].id == this.id) {
			clients.splice(i, 1);
			break;
		}
	}
}

function onTick() {
	gameStep++;
	stepTime = new Date().getTime();

	//set coords to nextcoords
	for (id in entities) {
		entities[id].coords = entities[id].nextCoords;
	}
	
	for (id in entities) {
		if (entities[id].control == 'bears') {
			bearAI(id);
		}
		entityStep(id, true);
	}
	
	var wait = nextTick - new Date().getTime();
	if (wait < 0) {
		wait = 0;
	}
	setTimeout(onTick,wait);
	nextTick += TICK_LEN;
}

function entityStep (id, firstCall) {
	var entity = entities[id];
	
	if (firstCall && entity.attacking > 0) {
		entity.attacking--;
	}
	
	if (entity.actions.length == 0) {
		return;
	}
	
	var action = entity.actions[0][0];
	
	var dest = action[1];
	if (!(dest instanceof Array)) {
		//dest is an entity
		if (!(dest in entities)) {
			finishAction(id);
			entityStep(id,false);
			return;
		}
		dest = entities[dest].coords;
	}
	
	//later any targeted action
	if (action[0] == 'atk') {
		if (LinAlg.pointDist(entity.coords, dest) > 48) {
			//place move action at front
			entity.actions.unshift([['move', action[1], 46],false]);
			entityStep(id,false);
			return;
		}
	}
	
	if (action[0] == 'move') {
		//broadcast action if new
		if (!entity.actions[0][1]) {
			entity.actions[0][1] = true;
			var msg = actionString(id, action);
			broadcast(msg);
		}
		
		var range = action[2];
		var distRemaining = LinAlg.pointDist(entity.coords,dest)-range;
		
		//float imprecision is likely to occur, play it safe
		if (distRemaining <= 0.1) {
			finishAction(id);
			entityStep(id, false);
		} else if (distRemaining <= entity.stats.spd) {
			var angle = LinAlg.pointAngle(dest, entity.coords);
			entity.nextCoords = LinAlg.pointOffset(dest, angle, range);
		} else {
			var angle = LinAlg.pointAngle(entity.coords, dest);
			entity.nextCoords = LinAlg.pointOffset(entity.coords, angle, entity.stats.spd);
		}
	} else if (action[0] == 'atk') {
		//already in range, according to check above
		if (entity.attacking == 0) {
			//broadcast
			var msg = actionString(id, action);
			broadcast(msg);
		
			//deal damage and set cooldown
			damageEntity(action[1], randRange(10,25));
			entity.attacking = entity.stats.atktime;
		}
	}
}

//causes the bear to attack the nearest non-bear within 300 units
function bearAI (bearid) {
	var bear = entities[bearid];
	if (bear.actions.length >= 1) {
		return;
	}
	
	var dist;
	var neardist = -1;
	var nearid;
	var entity;
	for (id in entities) {
		if (id == bearid) {
			continue;
		}
		entity = entities[id];
		dist = LinAlg.pointDist(bear.coords, entities[id].coords);
		if (entity.control != bear.control && dist <= 300 && (dist < neardist || neardist == -1)) {
			neardist = dist;
			nearid = id;
		}
	}
	if (neardist != -1) {
	 var action = ['atk', nearid];
	 addAction(bearid,action,true);
	}
}

function addAction (id, action, clear) {
	var entity = entities[id];
	if (clear) {
		entity.actions = [];
	}
	entity.actions.push([action,false]);
}

function finishAction (id) {
	var entity = entities[id];
	entity.actions.shift();
	
	if (entity.actions.length == 0) {
		var msg = JSON.stringify([gameStep, 'stop', id, entities[id].coords]);
		broadcast(msg);
	}
}

function actionString (id, action) {
	if (action[0] == 'move' || action[0] == 'atk') {
		return JSON.stringify([gameStep, action[0], id, entities[id].coords, action[1]]); 
	}
	return JSON.stringify([gameStep, 'stop', id, entities[id].coords]);
}

function addEntity (id, control, coords, sprite, stats) {
	entities[id] = {coords:coords, nextCoords:coords, control:control, stats:stats, sprite:sprite, attacking:0, actions:[]};
	for (var i = 0; i < clients.length; i++) {
		seeEntity(clients[i], id);
	}
}

function removeEntity (id) {
	delete entities[id];
	var data = JSON.stringify([gameStep, 'unsee', id]);
	for (var i = 0; i < clients.length; i++) {
		clients[i].send(data);
	}
}

function seeEntity (socket, entityid) {
	var entity = entities[entityid];
	socket.send(JSON.stringify([gameStep, 'see', entityid, determineControl(socket,entity), entity.coords, entity.sprite, entity.stats]));
	if (entity.actions.length > 0) {
		socket.send(actionString(id, entity.actions[0]));
	}
}

function seeAll (socket) {
	for (id in entities) {
		seeEntity(socket,id);
	}
}

function updateControl (entityid) {
	var data = JSON.stringify([gameStep, 'control', entityid, determineControl(clients[i],entities[entityid])]);
	broadcast(data);
}

function damageEntity(id, amount) {
	var data = JSON.stringify([gameStep, 'stat', id, {'hp':amount}]);
	broadcast(data);
	entity = entities[id];
	entity.stats.hp -= amount;
	if (entity.stats.hp < 0) {
		entity.stats.hp = 0;
		//death
		removeEntity(id);
	}
}

function determineControl(client, entity) {
	if (entity.control == client.playerId) {
		return 0;
	} else if (entity.control == 'bears') {
		return 3;
	} else {
		return 2;
	}
}

function randRange (minimum, maximum) {
	return Math.floor(Math.random()*maximum)+minimum;
}


util.log('Server running on port ' + port);

nextTick = new Date().getTime()+TICK_LEN;
onTick();
