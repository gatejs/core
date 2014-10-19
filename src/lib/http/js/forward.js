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
var net = require("net");
var crypto = require("crypto");

var forward = function() { /* loader below */ };

forward.list = {};
forward.sockets = [];

forward.log = function(gjs, connClose) {
	if(!connClose)
		connClose = gjs.response.statusCode;
	
	var version;
	if(gjs.request.spdyVersion)
		version = "SPDY/"+gjs.request.spdyVersion;
	else
		version = "HTTP/"+gjs.request.httpVersion;
	
	gjs.root.lib.core.logger.commonLogger(
		'FWLOG',
		{
			version: version,
			site: gjs.request.headers.host,
			ip: gjs.request.remoteAddress,
			code: connClose,
			method: gjs.request.method,
			url: gjs.request.url,
			outBytes: gjs.request.gjsWriteBytes ? gjs.request.gjsWriteBytes : '0',
			userAgent: gjs.request.headers['user-agent'] ? gjs.request.headers['user-agent'] : '-',
			referer: gjs.request.headers.referer ? gjs.request.headers.referer : '-',
			cache: gjs.response.gjsCache ? gjs.response.gjsCache : 'miss'
		}
	);
}

forward.logConnect = function(gjs, args) {
	gjs.lib.core.logger.commonLogger(
		'FWLOGCONNECT',
		args
	);
}

forward.logpipe = function(gjs, src) {
	if(!gjs.request.gjsWriteBytes)
		gjs.request.gjsWriteBytes = 0;
	
	/* accumulate counter */
	src.on('data', function(data) {
		gjs.request.gjsWriteBytes += data.length;
	});

	/* on client close connection */
	gjs.request.on('close', function() {
		forward.log(gjs, 499);
	});
	
	/* on response sent to client */
	gjs.response.on('finish', function() {
		forward.log(gjs);
	});
	src.pipe(gjs.response);
}

forward.loader = function(gjs) {
	
	if (cluster.isMaster) {
		var logger = gjs.lib.core.logger;
		
		/* create logging receiver */
		var processLog = function(req) {
			var dateStr = gjs.lib.core.dateToStr(req.msg.time);

			var inline = 
				dateStr+' - '+
				req.msg.site+' - '+
				req.msg.ip+' '+
				req.msg.version+' '+
				req.msg.cache.toUpperCase()+' '+
				req.msg.method+' '+
				req.msg.code+' '+
				req.msg.url+' '+
				'"'+req.msg.userAgent+'" '+
				req.msg.outBytes+' '+
				req.msg.referer+' '
			;
			
			/* write log */
			var f = logger.selectFile(null, 'forward-access');
			if(f) 
				f.stream.write(inline+'\n');
		}
		
		var processConnect = function(req) {
			var dateStr = gjs.lib.core.dateToStr(req.msg.time);

			var inline = 
				dateStr+
				' - CONNECT '+
				req.msg.code.toUpperCase()+' on '+
				req.msg.address+':'+
				req.msg.port+
				' from '+
				req.msg.remote
			;
			
			/* write log */
			var f = logger.selectFile(null, 'forward-connect');
			if(f) 
				f.stream.write(inline+'\n');
		}
		
		logger.typeTab['FWLOG'] = processLog;
		logger.typeTab['FWLOGCONNECT'] = processConnect;
		return;
	}
	
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
				title: "Pipeline terminated",
				explain: "Pipeline did not execute a breaking opcode"
			});
		});
		
		pipe.forward = true;
		pipe.root = gjs;
		pipe.request = request;
		pipe.response = response;
		pipe.server = server;
		
		gjs.lib.core.stats.http(pipe);
		
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
		
		var processConnectRequest = function(request, socket, head) {
			var s = request.url.split(':');
			var ip = socket.remoteAddress;
			
			/* open raw stream */
			var client = net.connect({
				host: s[0],
				port: s[1] ? s[1] : 80
				
			},
			function() {
				forward.logConnect(
					gjs, {
					version: request.httpVersion,
					code: 'open',
					reason: 'Connection established',
					remote: ip,
					address: s[0],
					port: s[1] ? s[1] : 80
				});
				socket.write('HTTP/1.0 200 Connection established\n\n');
				socket.pipe(client);
				client.pipe(socket);
			});
			client.on('error', function(err) {
				forward.logConnect(
					gjs, {
					version: request.httpVersion,
					code: 'error',
					reason: 'Connection error '+err.code+' on '+s.join(':'),
					remote: ip,
					address: s[0],
					port: s[1] ? s[1] : 80
				});
				socket.destroy();
			});
			socket.on('close', function(err) {
				forward.logConnect(
					gjs, {
					version: request.httpVersion,
					code: 'close',
					reason: 'Closing connection '+s.join(':'),
					remote: ip,
					address: s[0],
					port: s[1] ? s[1] : 80
				});
				client.destroy();
			});
			
		}
	
		
		/** \todo ssl needs file lookup */
		
		/* create network interface */
		var iface;
		if(sc.ssl == true) {
			gjs.lib.http.hardeningSSL(sc);
			
			if(!sc.key || !sc.cert) {
				gjs.lib.core.logger.error('HTTPS forward you need to set the key and cert for '+key);
				return(false);
			}
			
			/* get certs */
			gjs.lib.http.lookupSSLFile(sc);

			iface = https.createServer(sc);
			if(sc.isTproxy == true)
				iface.agent = gjs.lib.http.agent.httpsTproxy;
			else
				iface.agent = gjs.lib.http.agent.https;
			
			if(sc.allowConnect == true) 
				iface.on('connect', processConnectRequest);
		}
		else {
			iface = http.createServer();
			if(sc.isTproxy == true)
				iface.agent = gjs.lib.http.agent.httpTproxy;
			else
				iface.agent = gjs.lib.http.agent.http;
			
			if(sc.allowConnect == true) 
				iface.on('connect', processConnectRequest);
		}
		
		
		/* resolv pipeline */
		iface.pipeline = gjs.lib.core.pipeline.getGlobalPipe(sc.pipeline); 
		if(!iface.pipeline) {
			gjs.lib.core.logger.error('Enable to locate pipeline'+sc.pipeline);
			return(false);
		}
		
		iface.config = sc;
		
		iface.on('connection', function (socket) {
			gjs.lib.core.graceful.push(socket);
			
			gjs.lib.core.stats.diffuse('httpWaiting', gjs.lib.core.stats.action.add, 1);
			
			socket.setTimeout(60000);
			socket.on('close', function () {
				socket.inUse = false;
				gjs.lib.core.graceful.release(socket);
				gjs.lib.core.stats.diffuse('httpWaiting', gjs.lib.core.stats.action.sub, 1);
			});
		});

		iface.on('request', function(request, response) {
			request.connection.inUse = true;

			response.on('finish', function() {
				if(request.connection._handle)
					request.connection.inUse = false;
			});
// 			
			processRequest(this, request, response);
		});
		
		iface.on('listening', function() {
			gjs.lib.core.logger.system("Binding forward HTTP proxy on "+sc.address+":"+sc.port);
			iface.working = true;
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTP forward error for instance '+key+': '+e);
			console.log('* HTTP forward error for instance '+key+': '+e);
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
			if(server.working == true) {
				server.isClosing = true;
				server.close(function() { });
			}
		}
		
		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
	}
	
	/* add graceful receiver */
	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);
		
	return(false);
	
}

module.exports = forward;

