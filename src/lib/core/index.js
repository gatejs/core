/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core engine [http://www.binarysec.com]
 * 
 * This file is part of Gate.js.
 * 
 * Gate.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var fs = require('fs');
var crypto = require("crypto");

var core = function() { /* loader below */ };

core.utils = require(__dirname+'/build/Release/core.node');
core.ipaddr = require(__dirname+'/js/ipaddr.js');
core.ipc = require(__dirname+'/js/ipc.js');
core.npc = require(__dirname+'/js/npc.js');
core.logger = require(__dirname+'/js/logger.js');
core.blacklist = require(__dirname+'/js/blacklist.js');
core.graceful = require(__dirname+'/js/graceful.js');
core.pipeline = require(__dirname+'/js/pipeline.js');
core.stats = require(__dirname+'/js/stats.js');
core.plugin = require(__dirname+'/js/plugin.js');
core.hosts = require(__dirname+'/js/hosts.js');

function parseDoubleDot(dst, filename) {
	var lines = fs.readFileSync(filename).toString().split("\n");
	for(var a in lines) {
		var t = lines[a].split(':');
		if(t.length > 1)
			dst[t[0]] = t;
	}
}

core.usersByName = {}
core.groupsByName = {}

core.loader = function(gjs) {
	if(!gjs.serverConfig.runDir) {
		console.log('* No runDir defined, exiting');
		process.exit(0);
	}
	
	parseDoubleDot(core.usersByName, '/etc/passwd');
	parseDoubleDot(core.groupsByName, '/etc/group');	
	
	core.npc.loader(gjs);
	core.ipc.loader(gjs);
	core.logger.loader(gjs);
	core.blacklist.loader(gjs);
	core.graceful.loader(gjs);
	core.pipeline.loader(gjs);
	core.stats.loader(gjs);
	core.plugin.loader(gjs);
	core.hosts.loader(gjs);
}

core.getUser = function(name) {
	if(core.usersByName[name])
		return(core.usersByName[name]);
	return(null);
}

core.getGroup = function(name) {
	if(core.groupsByName[name])
		return(core.groupsByName[name]);
	return(null);
}

core.fixCamelLike = function(str) { 
	return str.replace(/(^|-)([a-zA-Z])/g,
		function (x, dash, chr) { 
			return dash + chr.toUpperCase(); 
	}); 
}

core.lookupSSLFile = function(options) {
	/* ca and crl as possible array */
	var root = gjs.serverConfig.dataDir+'/ssl';
	var keyLookup = ['cert', 'ca', 'pfx', 'key'];
	for(var a in keyLookup) {
		var z = keyLookup[a];
		if(options[z]) {
			var file = root+'/'+options[z];
			try {
				var fss = fs.statSync(file);
				options[z] = fs.readFileSync(file);
				
			} catch(e) {
				console.log('Can not open '+file+' '+e);
				return(false);
			}
		}
	}
	return(true);
}

function generate(min, max) {
	while(1) {
		var c = Math.random();
		while(1) {
			var n = c*10;
			if(n >= max)
				break;			
			c = n;
		}
		if(c >= min)
			break;
	}
	return(Math.floor(c));
}

core.generatePassword = function(minLen, maxLen) {
	var max = generate(minLen, maxLen);
	var password = '';
	for(var a=0; a<max; a++) {
		var sw = generate(0, 999);
		if(sw >= 666)
			password += String.fromCharCode(generate(0x30, 0x39));
		else if(sw >= 333)
			password += String.fromCharCode(generate(0x41, 0x5a));
		else
			password += String.fromCharCode(generate(0x61, 0x7a));	
	}
	return(password);
}


core.decipherPayload = function(payload, cryptoKey) {
	
	/* convert to binary */
	if(typeof cryptoKey === "string") {
		var c = crypto.createHash("sha256");
		c.update(cryptoKey, "utf8");
		cryptoKey = c.digest("binary");
	}
	
	/* inputs */
	var t = payload.split('-');
	var C = t[0], 
		IV = t[1], 
		Hm = t[2];
	
	if(typeof C !== "string" || typeof IV !== "string" || typeof Hm !== "string")
		return({ error: true, message: "Input problem" });

	/* compute hmac */
	var c = crypto.createHmac("sha256", cryptoKey);
	c.update(C, "ascii");
	c.update(IV, "ascii");
	c.update(cryptoKey, 'binary');
	var hmac = c.digest("hex");

	/* integrity control */
	if(hmac !== Hm)
		return({ error: true, message: "Bad HMAC control" });

	try {
		var dcp = crypto.createDecipheriv("aes-256-cbc", cryptoKey, new Buffer(IV, "hex"));
		var pl = dcp.update(payload, 'hex');
		pl += dcp.final("ascii");
	} catch(e) {
		return({ error: true, message: "Decipher: "+e.message });
	}

	try {
		js = JSON.parse(pl);
	} catch(e) {
		return({ error: true, message: "JSON error: "+e.message });
	}
	
	return({ error: false, data: js });
}

core.cipherPayload = function(data, cryptoKey) {
	/* convert to binary */
	if(typeof cryptoKey === "string") {
		var c = crypto.createHash("sha256");
		c.update(cryptoKey, "utf8");
		cryptoKey = c.digest("binary");
	}
	
	var iv = crypto.randomBytes(16);
	
	var c = crypto.createCipheriv("aes-256-cbc", cryptoKey, iv);
	var pl = c.update(JSON.stringify(data), 'utf8', "hex");
	pl += c.final("hex");
	iv = iv.toString("hex");
	
	c = crypto.createHmac("sha256", cryptoKey);
	c.update(pl, "ascii");
	c.update(iv, "ascii");
	c.update(cryptoKey, 'binary');
	var hmac = c.digest("hex");

	return(pl+"-"+iv+"-"+hmac);
}


core.dateToStr = core.utils.dateToStr;
core.cstrrev = core.utils.cstrrev;
core.nreg = core.utils.nreg;

module.exports = core;
