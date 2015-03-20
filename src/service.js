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
var child_process = require('child_process');
var os = require('os');

function runDaemon(opt) {
	if (process.env.__daemonized)
		return(false);
	console.log('* Running in background mode');
	var args = process.argv.slice(1);
	var prog = process.argv[0];
	process.env.__daemonized = true;
	var options = {
		stdio: ['ignore', 'ignore', 'ignore'],
		env: process.env,
		cwd: process.cwd,
		detached: true
	};
	var child = child_process.spawn(prog, args, options);
	child.unref();
	process.exit();
}

function runSpawner(gjs) {
	gjs.lib.core.loader(gjs);
	
	
	gjs.lib.core.ipc.on('requestSpawn', function() {
		
	});
	
	console.log('spawner');
}

var gatejs = (function() {
	this.version = "1.6";
	this.config = new Object;
	this.pipeline = new Object;

	this.serverConfig;

	this.randomString = (function(size) {
		var ret = new String, a;
		for(a=0; a<size; a++)
			ret += String.fromCharCode(Math.randomMax(24)+65);
		return(ret);
	});

	/* get options */
	this.options = {};
	for(var a=2; a<process.argv.length; a++) {
		var el = process.argv[a];
		var iOf = el.indexOf('=');
		if(iOf > -1)
			this.options[el.substr(0, iOf)] = el.substr(iOf+1);
		else
			this.options[el] = true;
	}
	
	/* check version */
	if(this.options['--version']) {
		console.log(
			"* gate.js version "+this.version+"\n"+
			"*\n"+
			'* V8 v'+process.versions.v8+"\n"+
			"* nodejs v"+process.versions.node+"\n"+
			'* openssl v'+process.versions.openssl+"\n"+
			'* libuv v'+process.versions.uv
		);
		process.exit(0);
	}
	
	/* Print print */
	if(cluster.isMaster) {
		console.log(
			'*              _          _     '+"\n"+
			'*   __ _  __ _| |_ ___   (_)___ '+"\n"+
			'*  / _` |/ _` | __/ _ \\  | / __|'+"\n"+
			'* | (_| | (_| | ||  __/_ | \\__ \\'+"\n"+
			'*  \\__, |\\__,_|\\__\\___(_)/ |___/'+"\n"+
			'*  |___/               |__/     '+"\n"+
			"* \n"+
			"* gate.js (c) 2007-2014 v"+this.version+" on "+os.type()+'/'+os.arch()
		);
	}
	
	/* check configuration options */
	var confFile = "./config.js";
	if(this.options['--config'])
		confFile = this.options['--config'];

	/* enable daemon mode */
	if(this.options['--daemon'])
		runDaemon();
	
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
	
	/* Load server configuration */
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
				try {
					var fss = fs.statSync(stage);
				} catch(a) {
					fs.mkdirSync(stage);
				}
			}
			catch(e) {
				console.log('* Error: can not create '+dir);
				process.exit(0);

			}
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
		
		/* check for spawner */
		if(this.options['--spawner']) {
			runSpawner(this);
			return(true);
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
	
	if(!this.serverConfig.runDir) {
		console.log('Please define a runDir');
		process.exit(0);
	}
	
	/* defaulting server processes */
	this.serverConfig.serverProcess = parseInt(this.serverConfig.serverProcess);
	if(!this.serverConfig.serverProcess) {
		this.serverConfig.serverProcess = os.cpus().length;
		/* reduce by one if possible in order to offer performances to the master */
		if(this.serverConfig.serverProcess > 1)
			this.serverConfig.serverProcess--;
	}
	
	/* running cluster */
	this.events.emit("clusterPreInit", this);
	this.cluster = cluster;
	if(cluster.isMaster) {	
		var pidFile = this.serverConfig.runDir+'/master.pid';
		fs.writeFile(pidFile, process.pid+"\n", function (err) {
			if (err) {
				console.log("Could not save "+pidFile+" with error code "+err.code);
				process.exit(0);
			}
		});
	
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
		/* check for setgid & setuid */
		if(this.serverConfig.groupId) {
			var u = this.lib.core.getGroup(this.serverConfig.groupId);
			if(!u)
				this.lib.core.logger.error('Can find group for setgid() "'+this.serverConfig.userId+'"');
			else 
				process.setgid(parseInt(u[2]));
		}
		if(this.serverConfig.userId) {
			var u = this.lib.core.getUser(this.serverConfig.userId);
			if(!u)
				this.lib.core.logger.error('Can find user for setuid() "'+this.serverConfig.userId+'"');
			else 
				process.setuid(parseInt(u[2]));
		}
	
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

