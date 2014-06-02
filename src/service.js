/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Service [http://www.binarysec.com]
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
	this.version = "1.0.0";
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
		console.log(
			'*              _          _     '+"\n"+
			'*   __ _  __ _| |_ ___   (_)___ '+"\n"+
			'*  / _` |/ _` | __/ _ \\  | / __|'+"\n"+
			'* | (_| | (_| | ||  __/_ | \\__ \\'+"\n"+
			'*  \\__, |\\__,_|\\__\\___(_)/ |___/'+"\n"+
			'*  |___/               |__/     '+"\n"+
			"* \n"+
			"* gate.js (c) 2007-2014 v"+this.version
		);
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
		process.title = 'gate.js Master process';
		var localThis = this;
		
		localThis.spawned = 0;
		
		function processGraceful() {
			if(localThis.spawned != localThis.serverConfig.serverProcess)
				return(false);
			
			localThis.lib.core.logger.system('Receive graceful rotation');
			
			/* tel processes to stop accepting connection */
			localThis.lib.core.ipc.send('LFW', 'system:graceful:process', false);
			
			/* spawn processes */
			for (var i = 0; i < localThis.serverConfig.serverProcess; i++) {
				cluster.fork();
				localThis.spawned++;
			}
			
			return(true);
		}
		
		this.lib.core.ipc.on('system:graceful', processGraceful);
		this.lib.core.ipc.on('SIGUSR2', processGraceful);
		
		for (var i = 0; i < this.serverConfig.serverProcess; i++) {
			cluster.fork();
			localThis.spawned++;
		}
		
		cluster.on('death', function(worker) {
			this.events.emit("clusterDeath", this, worker);
			localThis.spawned--;
		});
		
		cluster.on('exit', function(worker) {
			localThis.spawned--;
		});
		
		this.events.emit("clusterMasterInit", this);
	} 
	else {
		process.title = 'gate.js Slave process';
		/* receive IPC to for shuting down the process */
// 		this.lib.core.ipc.on('system:kill', function() {
// 			process.exit(0);
// 		});
		this.events.emit("clusterSlaveInit", this);
	}
	
	this.events.emit("clusterPostInit", this);

});

new gatejs();

