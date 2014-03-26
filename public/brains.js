var NUM_BRAINS = 50;
var TOP_AMOUNT = 4;
var NUM_NODES = [11,11,3];
var NUM_LAYERS = NUM_NODES.length;
var SIGMOID_POW = 5;
var PARENT_BIAS = 0.7;
var MUTATE_CHANCE = 0.02;

var RADIUS = 2000;

var NUM_SENSORS = 5;
var SENSOR_DIST = 1000;
var SENSOR_ARC = 120;

var FOOD_AMOUNT = 35;
var FOOD_VALUE = 250;
var COLLIDE_AMOUNT = 25;

var MAX_HP = 1000;
var MAX_SPEED = 5;
var MIN_SPEED = 1;
var TURN_RATE = 5;
var SHOT_SPEED = 30;
var SHOT_CD = 60;
var SHOT_DAMAGE = 50;
var SHOT_LIFE = 15;
var KILL_HITS = 3;
var SPAWN_IMMUNE_TIME = 5;

var DRAW_VECTORS = [[0,15],[225,10],[135,10]];

var GENERATION_STEPS = 10000;
var genStep = 0;
var generation = 1;

var CAMERA_SPEED = 50;
var camera = [0,0];

var canvas = document.getElementById("gameview");
canvas.setAttribute("tabindex", 0);
var context = canvas.getContext("2d");
context.fillStyle = "#FF0000";

var keys = new Object();
keys['CRTL'] = 17;
keys['LEFT'] = 37;
keys['UP'] = 38;
keys['RIGHT'] = 39;
keys['DOWN'] = 40;
var pressed = [];
for (key in keys) {
	pressed[keys[key]] = false;
}
canvas.addEventListener('keydown', onKeyDown, false);
canvas.addEventListener('keyup', onKeyUp, false);

function onKeyDown (e) {
	pressed[e.keyCode] = true;
}

function onKeyUp (e) {
	pressed[e.keyCode] = false;
}

var brains = [];
var bots = [];
var shots = [];
var food = [];

for (var i = 0; i < NUM_BRAINS; i++) {
	var brain = newBrain();
	brains.push(brain);
	bots.push(newBot(brain));
}

setInterval(onTick,33);

function onTick() {
	context.clearRect(0,0,RADIUS*2,RADIUS*2);

	//CAMERA
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
	if (pressed[keys['CRTL']]) {
		camera = [bots[0].coords[0]-500, bots[0].coords[1]-500];
	}
	
	//SPAWN FOOD
	while(food.length < FOOD_AMOUNT) {
		var coords = LinAlg.pointOffset([RADIUS,RADIUS], randRange(0,360), randRange(200,RADIUS-200));
		spawnFood(coords[0],coords[1],5,200);
	}
	
	//SEE
	for (var i = 0; i < bots.length; i++) {
		var bot = bots[i];
		for (var j = 0; j < NUM_SENSORS; j++) {
			for (var k = 0; k < 3; k++) {
				bot.sensors[j][k] = 0;
			}
		}
		//other
		for (var j = 0; j < bots.length; j++) {
			if (j == i) {
				continue;
			}
			var angle = angle180(LinAlg.pointAngle(bot.coords,bots[j].coords)-bot.angle);
			var dist = LinAlg.pointDist(bot.coords,bots[j].coords);
			if (Math.abs(angle) > SENSOR_ARC/2 || dist > SENSOR_DIST) {
				continue;
			}
			var a = Math.abs(angle) - SENSOR_ARC/NUM_SENSORS/2;
			var which = Math.floor(NUM_SENSORS/2);
			if (angle >= 0) {
				which += Math.ceil(a/(SENSOR_ARC/NUM_SENSORS));
			} else {
				which -= Math.ceil(a/(SENSOR_ARC/NUM_SENSORS));
			}
			var amount = (SENSOR_DIST-dist)/SENSOR_DIST;
			if (bot.sensors[which][0] < amount) {
				bot.sensors[which][0] = amount;
			}
		}
		
		//food
		for (var j = 0; j < food.length; j++) {
			var angle = angle180(LinAlg.pointAngle(bot.coords,food[j].coords)-bot.angle);
			var dist = LinAlg.pointDist(bot.coords,food[j].coords);
			if (Math.abs(angle) > SENSOR_ARC/2 || dist > SENSOR_DIST) {
				continue;
			}
			var a = Math.abs(angle) - SENSOR_ARC/NUM_SENSORS/2;
			var which = Math.floor(NUM_SENSORS/2);
			if (angle >= 0) {
				which += Math.ceil(a/(SENSOR_ARC/NUM_SENSORS));
			} else {
				which -= Math.ceil(a/(SENSOR_ARC/NUM_SENSORS));
			}
			var amount = (SENSOR_DIST-dist)/SENSOR_DIST;
			if (bot.sensors[which][1] < amount) {
				bot.sensors[which][1] = amount;
			}
		}
	}

	//THINK
	for (var i = 0; i < bots.length; i++) {
		var bot = bots[i];
		if (bot.cooldown > 0) {
			bot.cooldown--;
		}
		
		var inputs = [bot.hp/MAX_HP];
		//others
		for (var j = 0; j < NUM_SENSORS; j++) {
			inputs.push(bot.sensors[j][0]);
			inputs.push(bot.sensors[j][1]);
		}
		
		think(bot.brain,inputs);
	}
	
	//ACT
	for (var i = 0; i < bots.length; i++) {
		var bot = bots[i];
		bot.immune--;
		var speed = bot.brain.nodes[NUM_LAYERS-1][0].value;
		var speed = MIN_SPEED + speed*(MAX_SPEED-MIN_SPEED);
		var turn = bot.brain.nodes[NUM_LAYERS-1][1].value;
		if (turn > 0.5) {
			turn = 1 //counterclockwise
		} else {
			turn = -1;
		}
		var turnAmount = bot.brain.nodes[NUM_LAYERS-1][2].value * TURN_RATE;
		
		bot.angle += turn*turnAmount;
		bot.coords = LinAlg.pointOffset(bot.coords,bot.angle,speed);
		if (LinAlg.pointDist(bot.coords,[RADIUS,RADIUS]) > RADIUS) {
			var angle = LinAlg.pointAngle([RADIUS,RADIUS], bot.coords);
			bot.coords = LinAlg.pointOffset([RADIUS,RADIUS], angle, RADIUS-5);
		}
	}
	
	//SHOTS
	/*for (var i = shots.length-1; i >= 0; i--) {
		var shot = shots[i];
		
		for (var j = 0; j < SHOT_SPEED; j+=5) {
			shot.coords = LinAlg.pointOffset(shot.coords,shot.angle,5);
			for (var k = bots.length-1; k >= 0; k--) {
				if (bots[k].immune <= 0 && LinAlg.pointDist(shot.coords, bots[k].coords) < 10) {
					bots[k].hp -= SHOT_DAMAGE;
					shot.src.brain.hits++;
					if (bots[k].hp <= 0) {
						shot.src.brain.hits+=KILL_HITS;
						botDeath(k);
					}
					shot.life = -1;
					shots.splice(i,1);
					break;
				}
			}
			if (shot.life < 0) {
				break;
			}
		}
		shot.life--;
		if (shot.life <= 0) {
			shots.splice(i,1);
		}
	}*/
	
	//FOOD COLLISION AND HUNGER
	for (var i = 0; i < bots.length; i++) {
		var bot = bots[i];
		for (var j = food.length-1; j >= 0; j--) {
			if (LinAlg.pointDist(bot.coords,food[j].coords) < 15) {
				bot.hp += FOOD_VALUE;
				if (bot.hp > MAX_HP) {
					bot.hp = MAX_HP;
				}
				food.splice(j,1);
			}
		}
		
		for (var j = i+1; j < bots.length; j++) {
			if (LinAlg.pointDist(bot.coords,bots[j].coords) < 15) {
				bot.hp -= COLLIDE_AMOUNT;
				bots[j].hp -= COLLIDE_AMOUNT;
			}
		}
		
		bot.hp--;
		if (bot.hp <= 0) {
			botDeath(i);
		}
	}
	
	//DRAW
	//context.clearRect(0,0,RADIUS*2,RADIUS*2);
	
	context.strokeStyle = rgbaString([0,0,0],1.0);
	context.lineWidth = 5;
	context.beginPath();
	context.arc(RADIUS-camera[0], RADIUS-camera[1], RADIUS, 0, 2*Math.PI);
	context.stroke();
	context.lineWidth = 1;
	
	for (var i = 0; i < bots.length; i++) {
		drawBot(bots[i]);
	}
	for (var i = 0; i < shots.length; i++) {
		drawShot(shots[i]);
	}
	for (var i = 0; i < food.length; i++) {
		drawFood(food[i]);
	}
	
	//EVOLVE
	genStep++;
	if (genStep >= GENERATION_STEPS || bots.length <= TOP_AMOUNT) {
		for (var i = 0; i < bots.length; i++) {
			bots[i].brain.lifespan = genStep;
			bots[i].brain.hp = bots[i].hp;
		}
		genStep = 0;
		bots = [];
		shots = [];
		food = [];
		breedGeneration();
		for (var i = 0; i < NUM_BRAINS; i++) {
			bots.push(newBot(brains[i]));
		}
	}
}

function botDeath(i) {
	//bots.push(newBot(bots[i].brain));
	spawnFood(bots[i].coords[0], bots[i].coords[1], 2, 50);
	bots[i].brain.lifespan = genStep;
	bots[i].brain.hp = 0;
	bots.splice(i,1);
}

function spawnFood(x,y, amount, range) {
	for (var i = 0; i < amount; i++) {
		var coords = LinAlg.pointOffset([x,y], randRange(0,360), randRange(0,range));
		food.push({coords:coords});
	}
}

function breedGeneration () {
	brains.sort(function(b1,b2){return fitness(b2)-fitness(b1)});
	console.log('Generation ' + generation + ' best: ' + fitness(brains[0]));
	generation++;
	
	var cull = TOP_AMOUNT*(TOP_AMOUNT-1);
	brains = brains.slice(0,NUM_BRAINS-cull);
	
	for (var i = 0; i < brains.length; i++) {
		brains[i].hits = 0;
		brains[i].deaths = 0;
	}
	
	for (var i = 0; i < TOP_AMOUNT; i++) {
		for (var j = 0; j < TOP_AMOUNT; j++) {
			if (i == j) {
				continue;
			}
			brains.push(breed(brains[i],brains[j]));
		}
	}
}

function fitness(brain) {
	return brain.lifespan + brain.hp;
}

function drawBot(bot) {
	context.fillStyle = bot.color;
	context.beginPath();
    context.arc(bot.coords[0]-camera[0], bot.coords[1]-camera[1], 10, 0, 2*Math.PI, false);
    context.fill();
    
    context.strokeStyle = 'black';
    context.stroke();
    
    var center = [bot.coords[0]-camera[0], bot.coords[1]-camera[1]];
    var p1 = LinAlg.pointOffset(center,bot.angle-SENSOR_ARC/2,10);
    var p2 = LinAlg.pointOffset(center,bot.angle+SENSOR_ARC/2,10);
    
    context.beginPath();
    context.moveTo(p1[0],p1[1]);
    context.lineTo(center[0], center[1]);
    context.lineTo(p2[0], p2[1]);
    context.stroke();
    
    context.fillStyle = 'black';
    context.fillRect(bot.coords[0]-camera[0]-10, bot.coords[1]-camera[1]+10, 20*bot.hp/MAX_HP,5);
}

function drawShot(shot) {
	var point1 = shot.coords;
	var point2 = LinAlg.pointOffset(point1,shot.angle,5);
	
	point1 = [point1[0]-camera[0], point1[1]-camera[1]];
	point2 = [point2[0]-camera[0], point2[1]-camera[1]];
	
	context.beginPath();
	context.moveTo(point1[0], point1[1]);
	context.lineTo(point2[0], point2[1]);
	context.closePath();
	context.stroke();
}

function drawFood(f) {
	context.beginPath();
    context.arc(f.coords[0]-camera[0], f.coords[1]-camera[1], 5, 0, 2*Math.PI, false);
    context.fillStyle = 'green';
    context.fill();
}

function tryShoot(bot) {
	if (bot.cooldown <= 0 && bot.immune <= 0) {
		bot.cooldown = SHOT_CD;
		shots.push({coords:LinAlg.pointOffset(bot.coords,bot.angle,10), angle:bot.angle, life:SHOT_LIFE, src:bot});
	}
}

function angle180 (angle) {
	while (angle > 180) {
		angle -= 360;
	}
	while (angle < -180) {
		angle += 360;
	}
	return angle;
}

function newBrain () {
	var brain = {nodes:[], lifespan:0, hp:0};
	for (var j = 0; j < NUM_NODES.length; j++) {
		var layer = [];
		var numInputs;
		if (j == 0) {
			numInputs = 0;
		} else {
			numInputs = NUM_NODES[j-1];
		}
		for (var k = 0; k < NUM_NODES[j]; k++) {
			layer.push(newNode(numInputs));
		}
		brain.nodes.push(layer);
	}
	return brain;
}

function newBot (brain) {
	var coords = LinAlg.pointOffset([RADIUS,RADIUS], randRange(0,360), randRange(0,RADIUS));
	var bot = {coords:coords, angle:randRange(0,360), cooldown:0, hp:MAX_HP, brain:brain, immune:SPAWN_IMMUNE_TIME, sensors:[]};
	for (var i = 0; i < NUM_SENSORS; i++) {
		bot.sensors.push([0,0,0]);
	}
	think(brain,[1,1,1,1,1,1,1,1,1,1,1]);
	bot.color = rgbaString([Math.round(brain.nodes[NUM_LAYERS-1][0].value*255), Math.round(brain.nodes[NUM_LAYERS-1][1].value*255), Math.round(brain.nodes[NUM_LAYERS-1][2].value*255)],1.0);
	return bot;
}

function newNode (numInputs) {
	var node = {value:0, inputs:[]};
	for (var i = 0; i < numInputs; i++) {
		node.inputs.push(randRange(-1,1));
	}
	if (numInputs != 0) {
		node.inputs.push(randRange(-1,1));
	}
	return node;
}

function think (brain, inputs) {
	for (var i = 0; i < inputs.length; i++) {
		brain.nodes[0][i].value = inputs[i];
	}
	//for each layer
	for (var i = 1; i < NUM_NODES.length; i++) {
		//for each node
		for (var j = 0; j < NUM_NODES[i]; j++) {
			var sumVals = 0;
			//for each input
			var weight;
			for (var k = 0; k < NUM_NODES[i-1]; k++) {
				weight = brain.nodes[i][j].inputs[k];
				sumVals += brain.nodes[i-1][k].value*weight;
			}
			//bias
			weight = brain.nodes[i][j].inputs[NUM_NODES[i-1]];
			sumVals += weight;
			
			brain.nodes[i][j].value = sigmoid(sumVals);
		}
	}
}

function breed(brain1, brain2) {
	var brain = {nodes:[], lifespan:0, hp:0};
	for (var i = 0; i < NUM_NODES.length; i++) {
		var layer = [];
		for (var j = 0; j < NUM_NODES[i]; j++) {
			var node = {value:0, inputs:[]};
			for (var k = 0; k < brain1.nodes[i][j].inputs.length; k++) {
				if (chance(MUTATE_CHANCE)) {
					node.inputs.push(randRange(-1,1));
				} else if (chance(PARENT_BIAS)) {
					node.inputs.push(brain1.nodes[i][j].inputs[k]);
				} else {
					node.inputs.push(brain2.nodes[i][j].inputs[k]);
				}
			}
			layer.push(node);
		}
		brain.nodes.push(layer);
	}
	return brain;
}

function sigmoid(input) {
	return(1/(1+Math.pow(Math.E,input*-1*SIGMOID_POW)));
}

function randRange (minimum, maximum) {
	return Math.random()*(maximum-minimum)+minimum
}

function chance (p) {
	return Math.random() <= p;
}

function rgbaString (rgb, a) {
	return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
}
