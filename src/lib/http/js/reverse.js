/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Reverse proxy [http://www.binarysec.com]
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

var http = require("http");
var https = require("https");
var url = require("url");
var cluster = require("cluster");
var fs = require("fs");
var crypto = require("crypto");

var reverse = function() { /* loader below */ };

reverse.list = {};
reverse.sockets = [];

reverse.attachSite = function(key, config) {
	if(!reverse.list[key]) {
// 		console.log("Unknown http configuration "+key);
		return(false);
	}

	reverse.list[key].sites.push(config);
	return(true);
}

  	 
reverse.loader = function(gjs) {
	if (cluster.isMaster)
		return;

// 	function lookupServername(sites, host) {
// 		for(var a in sites) {
// 			var sConf = sites[a];
// 			for(var b in sConf.serverName) {
// 				var z = sConf.serverName[b];
// 				if(z == host)
// 					return(sConf);
// 			}
// 		}
// 		return(false);
// 	}
	
	var processRequest = function(server, request, response) {
		var pipe = gjs.lib.core.pipeline.create(null, null, function() {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 513, 
				tpl: "5xx", 
				log: false,
				title:  "Pipeline terminated",
				explain: "Pipeline did not execute a breaking opcode"
			});
		});
		
		pipe.root = gjs;
		pipe.request = request;
		pipe.response = response;
		pipe.server = server;
		
		/* parse the URL */
		try {
			pipe.request.urlParse = url.parse(request.url, true);
		} catch(e) {
			gjs.lib.core.logger.error('URL Parse error on from '+request.remoteAddress);
			request.connection.destroy();
			return;
		}
		
		/* lookup little FS */
		var lfs = gjs.lib.http.littleFs.process(request, response);
		if(lfs == true)
			return;
		
		/* get iface */
		var iface = reverse.list[server.gjsKey];
		if(!iface) {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 500, 
				tpl: "5xx", 
				log: false,
				title:  "Internal server error",
				explain: "no iface found, fatal error"
			});
			gjs.lib.core.logger.error('No interface found for key '+server.gjsKey+' from '+request.remoteAddress);
			return;
		}
		pipe.iface = iface;
		
		/* lookup website */
		
		/* execute pipeline */
		pipe.resume();
		pipe.execute();
	};
	
	var slowLoris = function(socket) {
		console.log("Probable SlowLoris attack from "+socket.remoteAddress+", closing.");
		clearInterval(socket.gjs.interval);
		socket.destroy();
	}
	
	var bindHttpServer = function(key, sc) {
		console.log("Binding HTTP server on "+sc.address+":"+sc.port);
		var iface = http.createServer(function(request, response) {
// 			clearInterval(request.socket.gjs.interval);
// 			if(!currentServer.requestCount)
// 				currentServer.requestCount = 0;
			
// 			currentServer.requestCount++;
			processRequest(this, request, response);
			
		});
		
		iface.on('connection', (function(socket) {
			reverse.sockets.push(socket);
			socket.setTimeout(60000);
			socket.inUse = false;
			socket.on('close', function () {
				socket.inUse = false;
				reverse.sockets.splice(reverse.sockets.indexOf(socket), 1);
			});
		}));
		
		iface.on('listening', function() {
			gjs.lib.core.logger.system("Binding HTTP reverse proxy on "+sc.address+":"+sc.port);
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTP reverse error for instance '+key+': '+e);
		});
		
		iface.gjsKey = key;
		iface.allowHalfOpen = false;
		iface.listen(sc.port, sc.address);
		
		return(iface);
	}
	
	
	var bindHttpsServer = function(key, sc) {
		if(!lookupSSLFile(sc)) {
			console.log("Can not create HTTPS server on "+sc.address+':'+sc.port);
			return(false);
		}
		
		sc.SNICallback = function(hostname) {
			var sites = reverse.list[key].sites;
			var site = lookupServername(sites, hostname);
			if(site && site.sslSNI) {
				/* can not use SNI  */
				if(site.sslSNI.usable == false)
					return(false);
				
				/* SNI resolved */
				if(site.sslSNI.resolv)
					return(site.sslSNI.crypto.context);
				
				/* ok wegjsite has SNI certificate check files */
				if(!lookupSSLFile(site.sslSNI)) {
					site.sslSNI.usable = false;
					site.sslSNI.resolv = true;
					return(false);
				}
				site.sslSNI.usable = true;
				site.sslSNI.resolv = true;
				
				/* associate crypto Credentials */
				site.sslSNI.crypto = crypto.createCredentials(site.sslSNI);
				return(site.sslSNI.crypto.context);
			}
		}
		
		console.log("Binding HTTPS server on "+sc.address+":"+sc.port);
		var iface = https.createServer(sc, function(request, response) {
// 			clearInterval(request.socket.gjs.interval);
// 			if(!currentServer.requestCount)
// 				currentServer.requestCount = 0;
			
// 			currentServer.requestCount++;
			processRequest(this, request, response);
			
		});
		
		iface.on('connection', (function(socket) {
			reverse.sockets.push(socket);
			socket.setTimeout(60000);
			socket.inUse = false;
			socket.on('close', function () {
				socket.inUse = false;
				reverse.sockets.splice(reverse.sockets.indexOf(socket), 1);
			});
		}));
		
		iface.on('listening', function() {
			gjs.lib.core.logger.system("Binding HTTP reverse proxy on "+sc.address+":"+sc.port);
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTP reverse error for instance '+key+': '+e);
		});
		
		iface.gjsKey = key;
		iface.allowHalfOpen = false;
		iface.listen(sc.port, sc.address);
		
		return(iface);
	}

	/*
	 * Associate interface and configuration
	 */
	function processConfiguration(key, o) {
		if(o.type == 'reverse') {
			if(!reverse.list[key]) {
				reverse.list[key] = {
					sites: [],
					ifaces: []
				};
			}
			/* defaulting */
			if(!o.address) o.address = '0.0.0.0';
			if(!o.port)
				o.port = o.ssl == true ? 443 : 80;
			if(o.ssl == true)
				reverse.list[key].ifaces.push(bindHttpsServer(key, o));
			else 
				reverse.list[key].ifaces.push(bindHttpServer(key, o));
		}
	}
	
	/* Load opcode context */
	reverse.opcodes = gjs.lib.core.pipeline.scanOpcodes(
		__dirname+'/pipeReverse',
		'reversing'
	);
	if(!reverse.opcodes)
		return(false);
	
	/* 
	 * Follow configuration
	 */
	for(var a in gjs.serverConfig.http) {
		var sc = gjs.serverConfig.http[a];
		if(sc instanceof Array) {
			for(var b in sc)
				processConfiguration(a, sc[b]);
		}
		else if(sc instanceof Object)
			processConfiguration(a, sc);
	}
	
	function gracefulAgentControler() {
		if(reverse.sockets.length == 0) {
			console.log('Process #'+process.pid+' graceful completed');
			process.exit(0);
		}
		
		console.log('Graceful agent controler has '+reverse.sockets.length+' sockets in queue');
		for(var a in reverse.sockets) {
			var s = reverse.sockets[a];
	
			if(s.inUse == false)
				s.destroy();
			else
				console.log(
					'Waiting for connection to be destroyed '+
					s._peername.address+':'+s._peername.port+
					' in process '+process.pid);
		}
	}
	
	function gracefulReceiver() {
	
		for(var a in reverse.list) {
			var config = reverse.list[a];
		
			/* close all server accept */
			for(var b in config.ifaces) {
				var server = config.ifaces[b];
				server.isClosing = true;
				server.close(function() { });
			}
		}
		setInterval(gracefulAgentControler, 5000);
		
		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
	}
	
	/* add graceful receiver */
// 	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);
	
	return(false);
	
}

module.exports = reverse;

