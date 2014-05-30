/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Forward proxy [http://www.binarysec.com]
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

var forward = function() { /* loader below */ };

forward.list = {};
forward.sockets = [];

/* 
 * Watch input stream to calculate log
 */
forward.log = function(gjs) {
// 	gjs.root.lib.core.logger.siteAccess({
// 		version: gjs.request.httpVersion,
// 		site: gjs.request.selectedConfig.serverName[0],
// 		ip: gjs.request.remoteAddress,
// 		code: gjs.response.statusCode,
// 		method: gjs.request.method,
// 		url: gjs.request.url,
// 		outBytes: gjs.request.gjsWriteBytes ? gjs.request.gjsWriteBytes : '0',
// 		userAgent: gjs.request.headers['user-agent'] ? gjs.request.headers['user-agent'] : '-',
// 		referer: gjs.request.headers.referer ? gjs.request.headers.referer : '-',
// 		cache: gjs.response.gjsCache ? gjs.response.gjsCache : 'miss'
// 	});
}

forward.logpipe = function(gjs, src) {
	if(!gjs.request.gjsWriteBytes)
		gjs.request.gjsWriteBytes = 0;
	
	src.on('data', function(data) {
		gjs.request.gjsWriteBytes += data.length;
		
	});
	src.on('end', function() {
// 		console.log('src > end');
// 		gjs.request = null;
// 		gjs.response = null;
		
	});
	src.on('error', function(err) {
// 		console.log('src > error');
// 		console.log("write error logpipe");
// 		gjs.response.destroy();
// 		gjs.request = null;
// 		gjs.response = null;
		
	});
	gjs.response.on('error', function() {
// 		console.log('res > error');
// 		gjs.request = null;
// 		gjs.response = null;
		src.destroy();
	});
	gjs.response.on('finish', function() {
// 		console.log('res > finish');
		
// 		gjs.request = null;
// 		gjs.response = null;
		src.destroy();
		
	});
	src.pipe(gjs.response);
	
	
}

forward.loader = function(gjs) {
	if (cluster.isMaster)
		return;

	
// 	/* read configuration and bind servers */	
// 	http.globalAgent.maxSockets = 1000;
// 	https.globalAgent.maxSockets = 1000;
	
	var processRequest = function(server, request, response) {
		request.remoteAddress = request.connection.remoteAddress;
		
		var pipe = gjs.lib.core.pipeline.create(forward.opcodes, server.pipeline, function() {
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
		var iface = forward.list[server.gjsKey];
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

		/* execute pipeline */
		pipe.resume();
		pipe.execute();
	};
	
// 	var slowLoris = function(socket) {
// 		console.log("Probable SlowLoris attack from "+socket.remoteAddress+", closing.");
// 		clearInterval(socket.bwsFg.interval);
// 		socket.destroy();
// 	}
	
	var bindHttpServer = function(key, sc) {
		/* sanatize */
		if(!sc.pipeline) {
			gjs.lib.core.logger.error('HTTP proxy instance '+key+' needs a pipeline');
			return(false);
		}
		if(!sc.address) sc.address = '0.0.0.0';
		if(!sc.port)
			sc.port = sc.ssl == true ? 443 : 80;
		if(!sc.timeout)
			sc.timeout = 30;
		
		/** \todo ssl needs file lookup */
		
		/* create network interface */
		var iface;
		if(sc.ssl == true) {
			if(!sc.key || !sc.cert) {
				gjs.lib.core.logger.error('HTTPS forward you need to set the key and cert for '+key);
				return(false);
			}
			iface = https.createServer();
		}
		else
			iface = http.createServer();
		
		/* resolv pipeline */
		iface.pipeline = gjs.lib.core.pipeline.getGlobalPipe(sc.pipeline); 
		if(!iface.pipeline) {
			gjs.lib.core.logger.error('Enable to locate pipeline'+sc.pipeline);
			return(false);
		}
		
		iface.config = sc;
		
		iface.on('connection', function (socket) {
			gjs.lib.core.graceful.push(socket);
			
			socket.setTimeout(60000);
			socket.on('close', function () {
				gjs.lib.core.graceful.release(socket);
				socket.inUse = false;
			});
		});

		iface.on('request', function(request, response) {
			request.connection.inUse = true;

// 			clearInterval(request.socket.bwsFg.interval);

			response.on('finish', function() {
				if(request.connection._handle)
					request.connection.inUse = false;
			});
// 			
			processRequest(this, request, response);
		});
		
		iface.on('listening', function() {
			gjs.lib.core.logger.system("Binding forward HTTP proxy on "+sc.address+":"+sc.port);
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTP forward error for instance '+key+': '+e);
		});
		
		iface.gjsKey = key;

		iface.allowHalfOpen = false;
	
		/* listen */
		if(sc.isTproxy == true)
			iface.listenTproxy(sc.port, sc.address);
		else
			iface.listen(sc.port, sc.address);

		return(iface);
	}

	/*
	 * Associate interface and configuration
	 */
	function processConfiguration(key, o) {
		if(o.type == 'forward') {
			var r = bindHttpServer(key, o);
			if(r != false)
				forward.list[key] = r;
		}
	}
	
	/* Load opcode context */
	forward.opcodes = gjs.lib.core.pipeline.scanOpcodes(
		__dirname+'/pipeForward',
		'forwarding'
	);
	if(!forward.opcodes)
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
	
	function gracefulReceiver() {
		for(var a in forward.list) {
			var server = forward.list[a];
			server.isClosing = true;
			server.close(function() { });
		}
		
		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
	}
	
	/* add graceful receiver */
	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);
		
	return(false);
	
}

module.exports = forward;

