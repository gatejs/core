
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const coreUtils = require(__dirname+'/build/Release/core.node');

var utils = function() {};

utils.strReverse = function(str) {
	return(str.split('').reverse().join(''));
};

utils.cstrrev = coreUtils.cstrrev;

utils.lib = function(name) {
	var f;
	try {
		f = gui.__dirname + '/lib/' + name;
		return(require(f.safePath()));
	}
	catch(e) {}

	return(null);
};


utils.eachObject = function(objs, executor) {

	var aObjects = [];

	// transpose objets to array
	for(var a in objs)
		aObjects.push([a, objs[a]]);

	function next() {

		var o = aObjects.shift();
		if(!o) {
			executor(null, null, next, true)
			return;
		}

		executor(o[0], o[1], next, false)
	}

	process.nextTick(next);
}

utils.eachArray = function(list, executor) {
	var index = 0;
	if(!Array.isArray(list))
		return(executor(null, null, null, true))
	function next() {

		var o = list[index];
		if(!o) {
			executor(null, null, null, true)
			return;
		}
		index++;
		executor(index, o, next, false)
	}

	process.nextTick(next);
}

utils.sync = function(list, finish) {
	function next(index) {
		var exec = list[index];
		if(!exec) {
			if(finish) finish()
			return;
		}
		exec(() => {
			index++;
			process.nextTick(next, index);
		})
	}
	process.nextTick(next, 0);
}


/* Avoid directory traversal. If it traverse, returns "/" or "/." */
utils.cleanPath = function(f) {
	/* On later versions of node, path.posix is available. Better for portability, since windows does not use '/' */
	f = path.relative('/', path.join('/', f));

	return('/' + f);
};

utils.mkdirDeep = function(dir) {
	var stage = '';
	var tab = dir.split("/");
	tab.pop();

	for(var a = 1; a<tab.length; a++) {
		stage += '/'+tab[a];
		try  {
			try {
				var fss = fs.statSync(stage);
			} catch(a) {
				fs.mkdirSync(stage);
			}
		}
		catch(e) {
			console.error('* Error: can not create '+dir);
			process.exit(0);
		}
	}
	return(true);
};

utils.buildSerial = function(serial) {
	var ret = serial.substr(0, 4)+'-';
	ret += serial.substr(4, 4)+'-';
	ret += serial.substr(8, 4)+'-';
	ret += serial.substr(12, 4)+'-';
	ret += serial.substr(20, 4);
	return(ret);
}

/*
 * Really low probability to hit this anytime soon
 * Use by the 3 next functions : objGet, objGet2, objSet, objUnset
 */
const maxNestedObjects = 128;
utils.objGet = function(obj, path, dft) {
	if(!(path instanceof Array))
		path = path.split('.');

	if(path.length > maxNestedObjects)
		return(dft);

	for(var i = 0 ; i < path.length && i < maxNestedObjects ; i++) {
		try {
			if(!Object.hasOwnProperty.call(obj, path[i]))
				return(dft);
			obj = obj[path[i]];
		}
		catch(e) {
			return(dft);
		}
	}

	return(obj);
}

utils.objGet2 = function(obj, path, dft) {
	if(typeof path == 'string') {
		try {
			if(Object.hasOwnProperty.call(obj, path))
				return(obj[path]);
		}
		catch(e) {}
	}

	return(utils.objGet(obj, path, dft));
}

utils.objSet = function(obj, path, val) {
	if(!(path instanceof Array))
		path = path.split('.');

	if(path.length > maxNestedObjects)
		return(maxNestedObjects);

	for(var i = 0 ; i < path.length - 1 ; i++) {
		try {
			if(!Object.hasOwnProperty.call(obj, path[i]))
				obj[path[i]] = {};
			obj = obj[path[i]];
		}
		catch(e) {
			return(i);
		}
	}

	try {
		obj[path[i]] = val;
	}
	catch(e) {
		return(i);
	}

	return(false);
}

utils.objUnset = function(obj, path) {
	var objList = [];

	if(!(path instanceof Array))
		path = path.split('.');

	if(path.length > maxNestedObjects)
		return(false);

	for(var i = 0 ; i < path.length ; i++) {
		try {
			if(!Object.hasOwnProperty.call(obj, path[i]))
				break;
			objList.push(obj);
			obj = obj[path[i]];
		}
		catch(e) {
			return(false);
		}
	}

	if(objList.length == path.length) {
		try {
			var obj = objList.pop();
			delete obj[path[path.length - 1]];
		}
		catch(e) {
			return(false);
		}
	}

	for(var i = objList.length - 1 ; i >= 0 ; i--) {
		var obj = objList[i];
		try {
			var keys = Object.keys(obj);
			if(keys.length == 1)
				delete obj[path[i]];
			else
				return(true);
		}
		catch(e) {
			return(false);
		}
	}

	return(true);
}


module.exports = utils;
