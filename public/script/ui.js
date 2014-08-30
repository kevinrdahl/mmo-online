var UI = {

BAR_HIGHLIGHT_TIME:500, //ms
SELECTION_HIGHLIGHT_TIME:150,

colorSets:{
	self:{
		hp:"#00AA00",
		highlight:"#AAFFAA",
		select:"#00FF00"
	},
	neutral:{
		hp:"#AAAA00",
		highlight:"#FFFFAA",
		select:"#FFFF00"
	},
	hostile:{
		hp:"#AA0000",
		highlight:"#FFAAAA",
		select:"#FF0000"
	},
	friendly:{
		hp:"#0000AA",
		highlight:"#AAAAFF",
		select:"#0000FF"
	}
},

/*==========
   BARS
==========*/
newBar:function(x,y,w,h,border,val,maxval) {
	var bar = {
		x:x,
		y:y,
		w:w,
		h:h,
		border:border,
		val:val,
		maxval:maxval,
		highlights:[]
	};
	return bar;
},

changeBar:function(bar, amount, time) {
	if (amount < 0) {
		this.addBarHighlight(bar, bar.val+amount, bar.val, time);
	}
	bar.val += amount;
},

addBarHighlight:function(bar, startval, endval, time) {
	bar.highlights.push([startval, endval, time]);
},

//time is the draw time, coords is in view coords
drawBar:function(context, bar, coords, colorset, time) {
	var bgLeft  = 	coords[0] + bar.x;
	var bgTop 	= 	coords[1] + bar.y; 
	var fgLeft  = 	bgLeft + bar.border;
	var fgTop 	= 	bgTop + bar.border;
	var fgW 		= 	bar.w - bar.border*2;
	var fgH 		= 	bar.h - bar.border*2;
	
	context.fillStyle = "#303030";
	context.fillRect(bgLeft, bgTop, bar.w, bar.h);
	
	//highlights
	context.fillStyle = colorset.highlight;
	var expired = 0;
	var lastLeft = -1;
	for (var i = 0; i < bar.highlights.length; i++) {
		var highlight = bar.highlights[i];
		var timediff = time - highlight[2];
		if (timediff >= UI.BAR_HIGHLIGHT_TIME) {
			expired++;
			continue;
		}
		var left = Math.round(fgLeft + highlight[0] / bar.maxval * fgW);
		var w;
		if (lastLeft == -1) {
			w = Math.round((highlight[1]-highlight[0]) / bar.maxval * fgW);
		} else {
			w = lastLeft-left;
		}
		if (w < 1) {
			continue;
		}
		context.globalAlpha = 1 - (timediff/UI.BAR_HIGHLIGHT_TIME);
		context.fillRect(left, fgTop, w, fgH);
	}
	bar.highlights.splice(0,expired);
	var w = Math.round(bar.val / bar.maxval * fgW);
	context.fillStyle = colorset.hp;
	context.globalAlpha = 1.0;
	context.fillRect(fgLeft,fgTop, w, fgH);
},

/*==========
 SELECTION
==========*/
newCircle:function(radius, width) {
	var circle = {
		radius:radius,
		width:width,
		highlight:-1
	};
	return circle;
},

highlightCircle:function(circle, time) {
	circle.highlight = time;
},

drawCircle:function(context, circle, coords, colorset, time) {
	var timediff = time-circle.highlight;
	var radius = circle.radius;
	if (timediff < UI.SELECTION_HIGHLIGHT_TIME) {
		radius *= timediff / UI.SELECTION_HIGHLIGHT_TIME;
	}
	context.strokeStyle = colorset.select;
	context.lineWidth = circle.width;
	drawEllipse(coords[0], coords[1], radius*2, radius);
}

}
