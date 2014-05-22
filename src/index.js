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

Math.randomMax = (function(max) {
	return(Math.floor(Math.random()*max)+1);
});

String.dirname = (function(path) {
	return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
});

var cluster = require('cluster');
var url = require("url");
var fs = require("fs");
var readline = require("readline");
var util = require("util");
var events = require('events');
var eventEmitter = new events.EventEmitter();

var gatejs = (function() {
	this.version = "1.0.0-DEV";
	this.config = new Object;
	this.pipeline = new Object;

	this.serverConfig;

	this.randomString = (function(size) {
		var ret = new String, a;
		for(a=0; a<size; a++)
			ret += String.fromCharCode(Math.randomMax(24)+65);	
		return(ret);
	});

	if(cluster.isMaster) {
		console.log("* GateJS v"+this.version);
		console.log(
			"*\n"+
			"* NodeJS v"+process.versions.node+
			' - V8 v'+process.versions.v8+
			' - OpenSSL v'+process.versions.openssl+
			' - libuv v'+process.versions.uv
		);
		
	}
	
	var loadGeneric = function(dir, dst) {
		try {
			var d = fs.readdirSync(dir), a;
			for(a in d) {
				if(d[a].search(/\.js$/) > 0) {
					var m = d[a].match(/(.*)\.js$/);
					var f = dir + '/' + m[1];
					dst[m[1]] = require(f);
				}
			}
		} catch(e) {
			console.log("Can not read directory "+e.path+" with error code #"+e.code);
			return(false);
		}
		return(true);
	}
	
	/* */
// 	loadGeneric(__dirname+'/pipeline', this.pipeline);
	

	/* Load server configuration */
	var confFile;
	if(process.argv[2])
		confFile = process.argv[2];
	else
		confFile = "./config.js";
	try {
		var fss = fs.statSync(confFile);
		var req = require(confFile);
		this.serverConfig = req(this);
	} catch(e) {
		console.log("Could not open configuration file "+confFile);
		return(false);
	}
	
	this.mkdirDeep = function(dir) {
		var stage = '';
		var tab = dir.split("/");
		for(var a = 1; a<tab.length-1; a++) {
			stage += '/'+tab[a];
			try  {
				fs.mkdirSync(stage);
			}
			catch(e) { return(false); }
		}
		return(true);
	}

	/* local events */
	this.events = eventEmitter;
	
//   if (process.env.NODE_ENV == 'DEVELOPMENT') {
//     mu.clearCache();
//   }
	
	/* load libraries */
	this.lib = {};
	function tryLoadLib(dir, file) {
		var filename = __dirname+'/lib/'+dir+'/'+file;
		try {
			var fss = fs.statSync(filename);
			return(filename);
		} catch(e) {
			/* file doesn't exist / do nothing */
		}
		return(false);
	}
	try {
		var d = fs.readdirSync(__dirname+'/lib'), a;
		for(a in d) {
			var file;
			if(file = tryLoadLib(d[a], 'index.js')) {
				/* do nothing */
			}
			else if(file = tryLoadLib(d[a], d[a]+'.js')) {
				/* do nothing */
			}
			else
				continue;
			
			this.lib[d[a]] = require(file);
		}
		
		/* post load modules */
		for(a in this.lib) {
			if(this.lib[a].loader)
				this.lib[a].loader(this);
		}
		
	} catch(e) {
		console.log("Can not read directory with error code #"+e);
		return(false);
	}
	
	/* post loading of pipelines */
	for(a in this.pipeline) {
		var b = this.pipeline[a];
		if(b.ctor)
			b.ctor(this);
	}
	
	/* running cluster */
	this.events.emit("clusterPreInit", this);
	this.cluster = cluster;
	if(cluster.isMaster) {

// 		var localThis = this;
// 		
// 		localThis.spawned = 0;
// 		
// 		function processGraceful() {
// 			if(localThis.spawned != localThis.serverConfig.serverProcess)
// 				return(false);
// 			
// 			console.log('Receive graceful rotation');
// 			
// 			/* tel processes to stop accepting connection */
// 			localThis.lib.bsCore.ipc.send('LFW', 'system:graceful:process', false);
// 			
// 			/* spawn processes */
// 			for (var i = 0; i < localThis.serverConfig.serverProcess; i++) {
// 				cluster.fork();
// 				localThis.spawned++;
// 			}
// 			
// 			return(true);
// 		}
// 		
// 		this.lib.bsCore.ipc.on('system:graceful', processGraceful);
// 		
// 		function checkMachineMemory() {
// 
// 			var machine = {};
// 			var matrix = {
// 				MemTotal: true,
// 				MemFree: true,
// 				Buffers: true,
// 				Cached: true,
// 				
// 			}
// 			var rs = fs.createReadStream('/proc/meminfo');
// 			var rd = readline.createInterface({
// 				input: rs,
// 				output: process.stdout,
// 				terminal: false
// 			});
// 
// 			rd.on('line', function(line) {
// 				var p = line.indexOf(':');
// 				var key = line.slice(0, p).trim();
// 				var value = line.slice(p+1).trim();
// 				value = value.slice(0, value.indexOf(' kB')).trim();
// 				if(matrix[key])
// 					machine[key] = value;
// 			});
// 			
// 			rs.on('end', function(line) {
// 				machine.realUsed = machine.MemTotal-machine.MemFree-machine.Buffers-machine.Cached;
// 				machine.readUsedPercentil = machine.realUsed*100/machine.MemTotal;
// 				
// 				var cv = 6.6;
// 				if(localThis.serverConfig.gracefulRam > 0)
// 					cv = localThis.serverConfig.gracefulRam;
// 				 
// 				var mcv = 50;
// 				if(localThis.serverConfig.gracefulRamForce > 0)
// 					mcv = localThis.serverConfig.gracefulRamForce;
// 				 
// 				
// 				/* check watermark */
// 				if(machine.readUsedPercentil > cv) {
// 					var ret = processGraceful();
// 					if(ret == true)
// 						console.log('Machine RAM usage high. Graceful order. p='+cv+' > '+machine.readUsedPercentil);
// 				}
// 				
// 				/* check max watermark */
// 				if(localThis.spawned > localThis.serverConfig.serverProcess && machine.readUsedPercentil > mcv) {
// 					// send force to kill 
// 					console.log('Master decides to shot childs');
// 					localThis.lib.bsCore.ipc.send('LFW', 'system:graceful:force', true);
// 				}
// 				
// 				rd.close();
// 				rs.close();
// 			});
// 		}
// 		setInterval(checkMachineMemory, 1000);

		for (var i = 0; i < this.serverConfig.serverProcess; i++) {
			cluster.fork();
// 			localThis.spawned++;
		}
		
		cluster.on('death', function(worker) {
			this.events.emit("clusterDeath", this, worker);
			console.log('worker ' + worker.pid + ' died');
// 			localThis.spawned--;
		});
		
		cluster.on('exit', function(worker) {
// 			console.log('worker ' + worker.pid + ' exited');
// 			localThis.spawned--;
		});
		
		this.events.emit("clusterMasterInit", this);
	} 
	else {
		/* receive IPC to for shuting down the process */
// 		this.lib.bsCore.ipc.on('system:kill', function() {
// 			process.exit(0);
// 		});
		this.events.emit("clusterSlaveInit", this);
	}
	
	this.events.emit("clusterPostInit", this);

});

new gatejs();

