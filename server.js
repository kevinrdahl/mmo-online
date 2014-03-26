var port = 8999;

var util = require('util');
var io = require('socket.io').listen(port, { log: false });
var LinAlg = require('./public/LinAlg');

var clients = [];
var entities = {};

var entityNum = 0;
var gameStep = 100;
var nextTick;


addEntity(entityNum, 'bears', [400,300], 'bear', {spd:3, hp:300, maxhp:300, atktime:30});
entityNum++;

io.sockets.on('connection', function (socket) {
	util.log('Client connected: ' + socket.id);
	socket.on('message', onMessage);
	socket.on('disconnect', onDisconnect);
	socket.set("log level", 0);
	
	socket.send(JSON.stringify([gameStep, 'ping']));
	newClient(socket);
});

function broadcast(msg) {
	for (var i = 0; i < clients.length; i++) {
		clients[i].send(msg);
	}
}

function onMessage(data) {
	var msg = JSON.parse(data);
	
	//don't want pings logged
	if (msg[0] == 'ping') {
		this.send(JSON.stringify([gameStep, 'ping']));
		return;
	}

	util.log(this.id + ': ' + data);
	
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
		msg[1] = '<b>[' + this.id + ']</b>: ' + msg[1];
		data = JSON.stringify([gameStep, msg[0], msg[1]]);
		broadcast(data);
	} else if (msg[0] == 'but') {
		if (msg[1] == 'red') {
			addEntity(entityNum, 'bears', [400,300], 'bear', {spd:3, hp:300, maxhp:300, atktime:30});
		} else if (msg[1] == 'green') {
			addEntity(entityNum, this.id, [24,300], 'man', {spd:5, hp:100, maxhp:100, atktime:30});
		} else if (msg[1] == 'yellow') {
			addEntity(entityNum, 'neutral', [100,600], 'man', {spd:5, hp:100, maxhp:100, atktime:30});
		}
		
		entityNum++;
	}
}

function onDisconnect() {
	util.log('Client disconnected: ' + this.id);
	if (this.id in entities) {
		removeEntity(this.id);
	}
	for (var i = 0; i < clients.length; i++) {
		if(clients[i].id == this.id) {
			clients.splice(i, 1);
			break;
		}
	}
}

function onTick() {
	for (id in entities) {
		if (entities[id].control == 'bears') {
			bearAI(id);
		}
		entityStep(id);
	}
	
	//now set coords to nextcoords
	for (id in entities) {
		entities[id].coords = entities[id].nextCoords;
	}
	
	gameStep++;
	
	var wait = nextTick - new Date().getTime();
	if (wait < 0) {
		wait = 0;
	}
	setTimeout(onTick,wait);
	nextTick += 33;
}

function entityStep (id) {
	var entity = entities[id];
	
	if (entity.attacking > 0) {
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
			entityStep(id);
			return;
		}
		dest = entities[dest].coords;
	}
	
	//later any targeted action
	if (action[0] == 'atk') {
		if (LinAlg.pointDist(entity.coords, dest) > 48) {
			//place move action at front
			entity.actions.unshift([['move', action[1], 46],false]);
			entityStep(id);
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
	
		if (LinAlg.pointDist(entity.coords,dest)-action[2] <= entity.stats.spd) {
			var angle = LinAlg.pointAngle(dest, entity.coords);
			entity.nextCoords = LinAlg.pointOffset(dest, angle, action[2]);
			finishAction(id);
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

function newClient (socket) {
	clients.push(socket);
	seeAll(socket);
	var start = [randRange(0,800), randRange(0,600)]
	addEntity(entityNum, socket.id, start, 'man', {spd:5, hp:100, maxhp:100, atktime:30});
	entityNum++;
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
	if (entity.control == client.id) {
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

nextTick = new Date().getTime()+33;
onTick();
