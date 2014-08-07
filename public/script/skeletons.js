var Skeletons = {
	animatedProperties:['angle'],
	newSkeleton:function() {
		var origin = [300,450];
		var originOffset = [0,-155];
		var scale = 1;
		var angle = 0;
		var bones = {
			chest:this.newBone(270,150,'origin',['head','shoulderleft','shoulderright'],false),
			head:this.newBone(270,50,'chest',[],false),
			
			legleft1:this.newBone(110,80,'origin',['legleft2'],false),
			legleft2:this.newBone(95,80,'legleft1',['footleft'],false),
			footleft:this.newBone(180,20,'legleft2',[],false),
			
			legright1:this.newBone(70,80,'origin',['legright2'],false),
			legright2:this.newBone(85,80,'legright1',['footright'],false),
			footright:this.newBone(0,20,'legright2',[],false),
			
			shoulderleft:this.newBone(-110,45,'chest',['armleft1'],true),
			armleft1:this.newBone(100,70,'shoulderleft',['armleft2'],false),
			armleft2:this.newBone(90,65,'armleft1',[],false),
			
			shoulderright:this.newBone(110,45,'chest',['armright1'],true),
			armright1:this.newBone(80,70,'shoulderright',['armright2'],false),
			armright2:this.newBone(90,65,'armright1',[],false)
		};

		var animations = {
			none:{duration:1}
		};

		for (name in bones) {
			var bone = bones[name];
			animations['none'][name] = {angle:[[0, bone.angle]]};
		}

		return {origin:origin, originOffset:originOffset, angle:angle, scale:scale, bones:bones, animations:animations, images:images};
	},

	newBone:function(angle, len, parent, children, rigid) {
		return {angle:angle, len:len, parent:parent, children:children, rigid:rigid};
	},
	
	//fast*
	fastSkeleton:function(skeleton) {
		var bones1 = skeleton.bones;
		var bones2 = [];
		var boneMap = {};
		
		var i = 0;
		for (name in bones1) {
			boneMap[name] = i++;
		}
		
		for (name in bones1) {
			var bone1 = bones1[name];
			var bone2 = this.deepCopy(bone1);
			bone2.parent = (bone1.parent == 'origin') ? -1 : boneMap[bone1.parent];
			bone2.children = [];
			for (var j = 0; j < bone1.children.length; j++) {
				bone2.children.push(boneMap[bone1.children[j]]);
			}
			bones2.push(bone2);
		}
		
		var anims1 = skeleton.animations;
		var anims2 = {};
		
		for (animname in anims1) {
			anims2[animname] = {duration:anims1[animname].duration, bones:[]};
			for (bonename in anims1[animname]) {
				var boneanims = anims1[animname][bonename];
				anims2[animname].bones[boneMap[bonename]] = this.deepCopy(boneanims);
			}
		}
		
		var skeleton2 = {};
		for (prop in skeleton) {
			if (typeof skeleton[prop] !== 'object') {
				skeleton2[prop] = skeleton[prop];
			}
		}
		skeleton2.bones = bones2;
		skeleton2.boneMap = boneMap;
		skeleton2.animations = anims2;
		skeleton2.originOffset = skeleton.originOffset;
		return skeleton2;
	},
	
	//Another dirty string-based function
	fastImageMap:function(imageMap, skeleton) {
		var boneMap = skeleton.boneMap;
		var str = JSON.stringify(imageMap);
		
		for (name in boneMap) {
			var strsplit = str.split('"'+name+'"');
			if (strsplit.length == 1) {
				continue;
			}
			str = '';
			for (var i = 0; i < strsplit.length-1; i++) {
				str += strsplit[i] + boneMap[name].toString();
			}
			str += strsplit[strsplit.length-1];
		}
		
		return JSON.parse(str);
	},
	
	//SLLLLOOOOWWWWWW
	deepCopy:function(obj) {
		return JSON.parse(JSON.stringify(obj));
	},

	poseSkeleton:function(skeleton, animation, time, mirror) {
		mirror = (typeof mirror === 'undefined') ? false : mirror;
		time = time % skeleton.animations[animation].duration;
		animation = skeleton.animations[animation];
		var bones = skeleton.bones;
		
		for (var i = 0; i < bones.length; i++) {
			for (prop in animation.bones[i]) {
				bones[i][prop] = this.getFrame(animation.bones[i][prop], time);
			}
		}
		
		for (var i = 0; i < bones.length; i++) {
			if (bones[i].parent == -1) {
				//parented to origin
				bones[i].coords = LinAlg.vectorSum(skeleton.origin, LinAlg.vectorScaled(skeleton.originOffset, skeleton.scale));
				this.poseBones(skeleton, bones[i], mirror);
			}
		}
		
		if (mirror) {
			for (var i = 0; i < bones.length; i++) {
				bones[i].coords = LinAlg.vectorFlipY(bones[i].coords, skeleton.origin[0]);
				bones[i].endcoords = LinAlg.vectorFlipY(bones[i].endcoords, skeleton.origin[0]);
			}
		}
	},

	poseBones:function(skeleton, bone) {
		var angle = bone.angle+skeleton.angle;
		if (bone.rigid) {
			angle += skeleton.bones[bone.parent].finalangle;
		}
		bone.finalangle = angle;
		
		bone.endcoords = LinAlg.pointOffset(bone.coords, angle, bone.len*skeleton.scale);
		for (var i = 0; i < bone.children.length; i++) {
			var child = skeleton.bones[bone.children[i]];
			child.coords = bone.endcoords;
			this.poseBones(skeleton,child);
		}
	},

	drawSkeleton:function(context, skeleton, imagemap, images, mirror) {
		mirror = (typeof mirror === 'undefined') ? false : mirror;
		this.context = context;
		var bones = skeleton.bones;
		for (var i = 0; i < imagemap.length; i++) {
			for (var j = 0; j < imagemap[i].length; j++) {
				//TODO: make fastImageMap
				var boneIndex = imagemap[i][j][0];
				this.drawBone(bones[boneIndex], imagemap[i][j][1], images, mirror);
			}
		}
	},

	//TODO: highlights should be indeces, not names
	drawWireframe:function(context, skeleton, highlights) {
		this.context = context;
		var bones = skeleton.bones;

		context.lineWidth = Math.ceil(3*skeleton.scale);
		context.strokeStyle = "#000000";
		for (var i = 0; i < bones.length; i++) {
			if (i in highlights) {
				continue;
			}
			this.drawWire(bones[i]);
		}
		
		context.strokeStyle = "#00FF00";
		for (var i = 0; i < highlights.length; i++) {
			if (highlights[i] == null || highlights[i] == 'origin')
				continue;
			this.drawWire(bones[skeleton.boneMap[highlights[i]]]);
		}

		//origin
		context.strokeStyle = '#FF0000';
		context.beginPath();
		var coords = LinAlg.vectorSum(skeleton.origin, LinAlg.vectorScaled(skeleton.originOffset,skeleton.scale));
		context.arc(coords[0], coords[1], 3, 0, 2*Math.PI);
		context.stroke();
		
		//position
		context.strokeStyle = '#0000FF';
		context.beginPath();
		context.arc(skeleton.origin[0], skeleton.origin[1], 3, 0, 2*Math.PI);
		context.stroke();
	},

	//NOTE: Skeletons sets its context variable each time it is told to draw the skeleton or wireframe
	//it is absolutely not thread safe, but this is javascript homie
	drawBone:function(bone, imagemap, images, mirror) {
		//[[image,width,height,anglerelative,offsetangle,offsetamount]*]
		var midpoint = LinAlg.midPoint(bone.coords,bone.endcoords);

		for (var i = 0; i < imagemap.length; i++) {
			var iparams = imagemap[i];
			var image = images[iparams[0]];
			/*if (!image[0]) {
				continue;
			}*/

			var coords;
			if (iparams[5] == 0) {
				coords = midpoint;
			} else {
				coords = LinAlg.pointOffset(midpoint,bone.finalangle+iparams[4], iparams[5]);
			}
			
			if (mirror) {
				context.save();
				context.translate(midpoint[0]*2, 0);
				context.scale(-1,1);
			}
			this.drawImageRotated(image,coords[0],coords[1],iparams[1]*skeleton.scale,iparams[2]*skeleton.scale,bone.finalangle+iparams[3]);
			if (mirror) {
				context.restore();
			}
		}
	},

	drawWire:function(bone) {
		var context = this.context;
		context.beginPath();
		context.moveTo(bone.coords[0], bone.coords[1]);
		context.lineTo(bone.endcoords[0], bone.endcoords[1]);
		context.stroke();
		
		context.beginPath();
		context.arc(bone.endcoords[0], bone.endcoords[1], 3, 0, 2*Math.PI);
		context.stroke();
	},

	//angle is degrees
	drawImageRotated:function(image, x, y, w, h, angle) {
		var context = this.context;
		context.save();
		context.translate(x, y);
		context.rotate(LinAlg.toRadians(angle));
		context.drawImage(image, -w/2, -h/2, w, h); //x,y,w,h
		context.restore(); 
	},

	//updates all references to a bone
	renameBone:function(skeleton, name, newname) {
		var bones = skeleton.bones;
		var bone = bones[name];
		if (bone.parent != 'origin' && bone.parent != null) {
			var parent = bones[bone.parent];
			parent.children.splice(parent.children.indexOf(name), 1);
			parent.children.push(newname);
		}
		for (var i = 0; i < bone.children.length; i++) {
			bones[children[i]].parent = newname;
		}
	},

	//adds bone to each animation
	addBoneAnimations:function(skeleton, bonename) {
		var animations = skeleton.animations;

		for (animationname in animations) {
			var animation = animations[animationname];
			animation[bonename] = {};
			for (var i = 0; i < this.animatedProperties.length; i++) {
				var property = this.animatedProperties[i];
				animation[bonename][property] = [[0,bone[property]]];
			}
		}
	},

	setBoneParent:function(skeleton, bonename, parentname) {
		var bones = skeleton.bones;
		var bone = bones[bonename];
		var parent = bones[parentname];

		if (bone.parent != 'origin' && bone.parent != null) {
			delete bones[bone.parent].children[bonename];	
		}
		
		parent.children.push(bonename);
		bone.parent = parentname;
	},

	//deletes a bone, and then recursively deletes its children
	//also removes it from animation definitions
	deleteBone:function(skeleton, name) {
		if (name == 'origin') {
			skeleton.bones = {};
			return;
		}

		var bones = skeleton.bones;
		var bone = bones[name];
		var animations = skeleton.animations;
		if (bone.parent != 'origin') {
			var parent = bones[bone.parent];
			parent.children.splice(parent.children.indexOf(name), 1);
		}
		while (bone.children.length > 0) {
			this.deleteBone(skeleton, bone.children[0]);
		}
		delete bones[name];
		
		for (animationname in animations) {
			delete animations[animationname][name];
		}

	},

	//TODO: instead of iterating over all keyframes to find prev/next, implement a modified binary search for n where n-1 <= n and n < n+1
	//given the keyframes of a property, returns the interpolated value at a specific time
	getFrame:function(keyframes, time) {
		if (keyframes.length == 1) {
			return keyframes[0][1];
		}
		
		var prevIndex = 0;
		var nextIndex = 0;
		for (var i = 0; i < keyframes.length; i++) {
			if (keyframes[i][0] <= time) {
				prevIndex = i;
			} else {
				nextIndex = i;
				break;
			}
		}
		if (nextIndex == 0) {
			return keyframes[prevIndex][1];
		}
		var prevTime = keyframes[prevIndex][0];
		var prevValue = keyframes[prevIndex][1];
		var nextTime = keyframes[nextIndex][0];
		var nextValue = keyframes[nextIndex][1];

		var progress = (time-prevTime)/(nextTime-prevTime); // [0,1)
		return prevValue + progress*(nextValue-prevValue); // [prevValue,nextValue)
	},

	setFrame:function(keyframes, time, value) {
		//find where in the list of keyframes to put this one
		var prevIndex = 0;
		for (var i = 0; i < keyframes.length; i++) {
			if (keyframes[i][0] <= time) {
				prevIndex = i;
			} else {
				break;
			}
		}

		if (keyframes[prevIndex][0] == time) {
			keyframes[prevIndex][1] = value;
		} else {
			keyframes.splice(prevIndex+1, 0, [time,value]);
		}

	},

	//deletes a keyframe
	deleteFrame:function(keyframes, time) {
		for (var i = 0; i < keyframes.length; i++) {
			if (keyframes[i][0] == time) {
				keyframes.splice(i,1);
				return;
			}
		}
	},

	addAnimation:function(skeleton, animationname, duration) {
		if (animationname in skeleton.animations) {
			alert("Skeleton already has animation \"" + animationname + "\"");
			return;
		}

		var animation = {duration:duration};

		for (bonename in skeleton.bones) {
			animation[bonename] = {};
			for (var i = 0; i < this.animatedProperties.length; i++) {
				var property = this.animatedProperties[i];
				animation[bonename][property] = [[0, skeleton.animations['none'][bonename][property][0][1]]]; //value of 'none' at frame 0
			}
		}
		
		skeleton.animations[animationname] = animation;
	},

	cloneAnimation:function(skeleton, sourcename, newname) {
		skeleton.animations[newname] = eval(JSON.stringify(skeleton.animations[sourcename]));
	},

	setAnimationDuration:function(skeleton, animationname, duration) {
		var animation = skeleton.animations[animationname];

		if (duration >= animation.duration) {
			animation.duration = duration;
			return;
		}

		animation.duration = duration;

		for (bonename in animation) {
			for (var i = 0; i < this.animatedProperties.length; i++) {
				var property = this.animatedProperties[i];
				var keyframes = animation[bonename][property];
				for (var j = 0; j < keyframes.length; j++) {
					if (keyframes[j][0] > duration-1) {
						keyframes.splice(j,1);
						j--;
					}
				}
			}
		}
	},

	deleteAnimation:function(skeleton, animationname) {
		delete skeleton.animations[animationname];
	}

};
