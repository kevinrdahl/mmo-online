var LinAlg = {};

if(typeof module === 'undefined') {
	//nuffin bruv
} else {
	module.exports = LinAlg;
}

LinAlg.pointDist = function(p1, p2) {
	return Math.sqrt(Math.pow(p1[0]-p2[0], 2) + Math.pow(p1[1]-p2[1], 2));
};

LinAlg.pointOffset = function(p, angle, dist) {
	angle = LinAlg.toRadians(angle);
	p2 = [p[0],p[1]];
	p2[0] += dist * Math.cos(angle);
	p2[1] += dist * Math.sin(angle);
	return [this.cutFloat(p2[0],2), this.cutFloat(p2[1],2)];
};

//angle in radians from p1 to p2
LinAlg.pointAngle = function(p1, p2) {
	return LinAlg.toDegrees(Math.atan2(p2[1]-p1[1], p2[0]-p1[0]));
};

LinAlg.midPoint = function(p1, p2) {
	return [p1[0]+(p2[0]-p1[0])/2, p1[1]+(p2[1]-p1[1])/2];	
};

LinAlg.toRadians = function(angle) {
	return (angle*Math.PI)/180.0;
};

LinAlg.toDegrees = function(angle) {
	return (angle*180)/Math.PI;
};

LinAlg.cutFloat = function(num, places) {
	var p = Math.pow(10,places);
	return Math.floor(num*p)/p;
};
