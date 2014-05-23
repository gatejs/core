/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * HTTP serving [http://www.binarysec.com]
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

/* 
 * Watch input stream to calculate log
 */
forward.log = function(bs) {
// 	bs.root.lib.bsCore.logger.siteAccess({
// 		version: bs.request.httpVersion,
// 		site: bs.request.selectedConfig.serverName[0],
// 		ip: bs.request.remoteAddress,
// 		code: bs.response.statusCode,
// 		method: bs.request.method,
// 		url: bs.request.url,
// 		outBytes: bs.request.bsWriteBytes ? bs.request.bsWriteBytes : '0',
// 		userAgent: bs.request.headers['user-agent'] ? bs.request.headers['user-agent'] : '-',
// 		referer: bs.request.headers.referer ? bs.request.headers.referer : '-',
// 		cache: bs.response.bsCache ? bs.response.bsCache : 'miss'
// 	});
}

forward.logpipe = function(bs, src) {
	if(!bs.request.bsWriteBytes)
		bs.request.bsWriteBytes = 0;
	
	src.on('data', function(data) {
		bs.request.bsWriteBytes += data.length;
		
	});
	src.on('end', function() {
// 		console.log('src > end');
// 		bs.request = null;
// 		bs.response = null;
		
	});
	src.on('error', function(err) {
// 		console.log('src > error');
// 		console.log("write error logpipe");
// 		bs.response.destroy();
// 		bs.request = null;
// 		bs.response = null;
		
	});
	bs.response.on('error', function() {
// 		console.log('res > error');
// 		bs.request = null;
// 		bs.response = null;
		src.destroy();
	});
	bs.response.on('finish', function() {
// 		console.log('res > finish');
		
// 		bs.request = null;
// 		bs.response = null;
		src.destroy();
		
	});
	src.pipe(bs.response);
	
	
}


forward.attachSite = function(key, config) {
	if(!forward.list[key]) {
// 		console.log("Unknown http configuration "+key);
		return(false);
	}

	forward.list[key].sites.push(config);
	return(true);
}


forward.loader = function(bs) {
// 	if (cluster.isMaster)
// 		return;
// 	
// 	forward.litteFsMimes = {
// 		jpg: 'image/jpeg',
// 		png: 'image/png',
// 		gif: 'image/gif',
// 		html: 'text/html',
// 		js: 'application/javascript',
// 	};
// 	
// 	/* generate virtualDirectory */
// 	var cp = crypto.createHash('sha512');
// 	cp.update(JSON.stringify(bs.serverConfig));
// 	forward.virtualDirectory = '/'+cp.digest('hex');
// 	
// 	/* read configuration and bind servers */	
// 	http.globalAgent.maxSockets = 1000;
// 	https.globalAgent.maxSockets = 1000;
// 	forward.sockets = [];
// 	
// 	forward.pipeStatus = {
// 		execute: 0,
// 		waiting: 1,
// 		stop: 2
// 	};
// 	
// 	forward.renderError = function(msg) {
// 		var filename = bs.serverConfig.libDir+'/pages/'+msg.tpl.replace(/\.\.\//, "/")+'.tpl';
// 		var pipe = msg.pipe;
// 		
// 		msg.pipe.response.headers = {
// 			server: "BinarySEC",
// 			pragma: 'no-cache',
// 			connection: 'close',
// 			'cache-control': 'max-age=0'
// 		};
// 		
// 		pipe.response.writeHead(msg.code, msg.pipe.response.headers);
// 		delete msg.pipe;
// 		msg.vd = forward.virtualDirectory;
// 
// 		var stream = bs.lib.mu2.compileAndRender(filename, msg);
// // 		if(msg.log == false)
// 			stream.pipe(pipe.response);
// // 		else
// // 			bs.lib.bwsFg.forward.logpipe(pipe, stream);
// 	}
// 	forward.renderHtml = forward.renderError;
// 	
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
// 	
// 	var processLittleFs = function(pipevar) {
// 		function processRendering(ret) {
// 			var filename = bs.serverConfig.libDir+'/pages'+ret[1].replace(/\.\.\//, "/");
// 			
// 			try {
// 				var sS = fs.statSync(filename);
// 			} catch(e) { return(false); }
// 			
// 			/* check extension */
// 			var ext = filename.substr(filename.lastIndexOf(".")+1);
// 			
// 			/* check mime */
// 			if(!forward.litteFsMimes[ext])
// 				return(false);
// 			
// 			pipevar.response.writeHead(200, {
// 				'Content-Type': forward.litteFsMimes[ext],
// 				'Content-Length': sS.size,
// 				'server': 'BinarySEC'
// 			});
// 
// 			var readStream = fs.createReadStream(filename);
// 			
// 			readStream.pipe(pipevar.response);
// // 			bs.lib.bwsFg.forward.logpipe(pipevar, readStream);
// 			
// 			return(true);
// 		}
// 		
// 		if(ret = pipevar.request.urlParse.path.match('^'+forward.virtualDirectory+'(.*)'))
// 			return(processRendering(ret));
// 
// 	
// 		return(false);
// 	}
// 	
// 	var processRequest = function(server, request, response) {
// 		request.remoteAddress = request.connection.remoteAddress;
// 		
// 		var pipevar = {
// 			root: bs,
// 			server: server,
// 			request: request,
// 			response: response,
// 			pipe: bs.serverConfig.pipeline,
// 			pipeStatus: forward.pipeStatus.execute,
// 			pipeIdx: 0
// 		};
// 		
// 		pipevar.stop = function() {
// 			/* stop execution */
// 			this.pipeStatus = forward.pipeStatus.stop;
// 			this.execute();
// 		}
// 		
// 		pipevar.pause = function() {
// 			/* wait for non blocking operation */
// 			this.pipeStatus = forward.pipeStatus.waiting;
// 		}
// 		
// 		pipevar.resume = function() {
// 			/* continue to execute pipeline */
// 			this.pipeStatus = forward.pipeStatus.execute;
// 		}
// 		
// 		pipevar.execute = function() {
// 			for(; pipevar.pipeIdx < pipevar.pipe.length;) {
// 				var arg = pipevar.pipe[pipevar.pipeIdx];
// 				var aloneArg = [];
// 				aloneArg.push(pipevar);
// 				for(var a = 1; arg instanceof Array && a<arg.length; a++) 
// 					aloneArg.push(arg[a]);
// 
// 				pipevar.pipeIdx++;
// 				var func = arg[0];
// 				func.apply(null, aloneArg);
// 			
// 				if(pipevar.pipeStatus == forward.pipeStatus.stop)
// 					return(true);
// 				else if(pipevar.pipeStatus == forward.pipeStatus.waiting)
// 					return(true);
// 			}
// 			
// 			/* continue to execute pipeline */
// 			forward.renderError({
// 				pipe: this, 
// 				code: 513, 
// 				tpl: "5xx", 
// 				log: false,
// 				title:  "No pipeline",
// 				explain: "No pipeline defined for domain name "+
// 					this.request.headers.host
// 			});
// 			
// 			return(false);
// 		}
// 		
// 		/* parse the URL */
// 		try {
// 			pipevar.request.urlParse = url.parse(request.url, true);
// 		} catch(e) {
// 			console.log("URL Parse error on "+pipevar.request.path+' from '+pipevar.request.connection.remoteAddress);
// 			forward.renderError({
// 				pipe: pipevar, 
// 				code: 400, 
// 				tpl: "5xx", 
// 				log: false,
// 				title:  "bad request",
// 				explain: "your request was considered as bad"
// 			});
// 		
// 			return;
// 		}
// 		
// 		/* lookup little FS */
// 		var lfs = processLittleFs(pipevar);
// 		if(lfs == true)
// 			return;
// 			
// 		/* get iface */
// 		var iface = forward.list[server.bwsFgKey];
// 		if(!iface) {
// 			forward.renderError({
// 				pipe: pipevar, 
// 				code: 500, 
// 				tpl: "5xx", 
// 				log: false,
// 				title:  "Internal server error",
// 				explain: "no iface found, fatal error"
// 			});
// 		
// 			return;
// 		}
// 		
// 
// // 			forward.renderError({
// // 				pipe: pipevar, 
// // 				code: 500, 
// // 				tpl: "5xx", 
// // 				log: false,
// // 				title:  "Internal server error",
// // 				explain: "buggy error out maman la branche"
// // 			});
// 			
// 
// // 
// 
// 		/* run pipeline */
// 		var ret = pipevar.execute();
// 	};
// 	
// 	var slowLoris = function(socket) {
// 		console.log("Probable SlowLoris attack from "+socket.remoteAddress+", closing.");
// 		clearInterval(socket.bwsFg.interval);
// 		socket.destroy();
// 	}
// 	
// 	
// 	
// 	var bindHttpServer = function(key, sc) {
// 		console.log("Binding HTTP server on "+sc.address+":"+sc.port);
// 		var iface = http.createServer();
// 		
// 	
// 		iface.on('connection', function (socket) {
// 			forward.sockets.push(socket);
// 			socket.setTimeout(60000);
// 			socket.inUse = false;
// 			socket.on('close', function () {
// 				socket.inUse = false;
// 				forward.sockets.splice(forward.sockets.indexOf(socket), 1);
// 			});
// 			
// 		});
// 
// 		iface.on('request', function(request, response) {
// 			request.connection.inUse = true;
// // 			console.log(request.method+' '+request.url);
// // 			clearInterval(request.socket.bwsFg.interval);
// // 			if(!currentServer.requestCount)
// // 				currentServer.requestCount = 0;
// 			
// // 			currentServer.requestCount++;
// 
// 			response.on('finish', function() {
// 				request.connection.inUse = false;
// 			});
// 			
// 			processRequest(this, request, response);
// 			
// 		});
// 		
// 		
// 		iface.bwsFgKey = key;
// 		
// 		if(bs.lib.bwsFg.httpTproxy.isTproxy)
// 			iface.listenTproxy(sc.port, sc.address);
// 		else
// 			iface.listen(sc.port, sc.address);
// 		
// 		iface.allowHalfOpen = false;
// 		
// 		return(iface);
// 	}
// 
// 	
// 	/*
// 	 * Associate interface and configuration
// 	 */
// 	function processConfiguration(key, o) {
// 		
// 		if(!forward.list[key]) {
// 			forward.list[key] = {
// 				sites: [],
// 				ifaces: []
// 			};
// 		}
// 		if(o.type == 'http')
// 			forward.list[key].ifaces.push(bindHttpServer(key, o));
// 	}
// 	
// 	/* 
// 	 * Follow configuration
// 	 */
// 	for(var a in bs.serverConfig.forward) {
// 		var sc = bs.serverConfig.forward[a];
// 		if(sc instanceof Array) {
// 			for(var b in sc)
// 				processConfiguration(a, sc[b]);
// 		}
// 		else if(sc instanceof Object)
// 			processConfiguration(a, sc);
// 	}
// 	
// 	function doReload() {
// 		var ret;
// 		
// 		/* clean website pointers */
// 		for(var key in forward.list)
// 			forward.list[key].sites = [];
// 	}
// 	
// 	/* handle reload */
// 	bs.lib.bsCore.ipc.on('SIGUSR2', doReload);
// 	bs.lib.bsCore.ipc.on('bwsFg:reload', doReload);
// 	
// 	function gracefulAgentControler() {
// 		
// // 		console.log(http.globalAgent.sockets);
// 		
// 		if(forward.sockets.length == 0) {
// 			console.log('Process #'+process.pid+' graceful completed');
// 			process.exit(0);
// 		}
// 		
// 		console.log('Graceful agent controler has '+forward.sockets.length+' sockets in queue');
// 		for(var a in forward.sockets) {
// 			var s = forward.sockets[a];
// 			
// 			
// 			if(s.inUse == false)
// 				s.destroy();
// 			else
// 				console.log(
// 					'Waiting for connection to be destroyed '+
// 					s._peername.address+':'+s._peername.port+
// 					' in process '+process.pid);
// 		}
// 	}
// 	
// 	function gracefulReceiver() {
// 		for(var a in forward.list) {
// 			var config = forward.list[a];
// 			
// 			
// 			/* close all server accept */
// 			for(var b in config.ifaces) {
// 				var server = config.ifaces[b];
// 				server.isClosing = true;
// 				server.close(function() {
// // 					console.log('server close');
// 				});
// 			}
// 		}
// 		setInterval(gracefulAgentControler, 5000);
// 		
// 		bs.lib.bsCore.ipc.removeListener('system:graceful:process', gracefulReceiver);
// 		
// 		/* receive IPC to for shuting down the process */
// 		bs.lib.bsCore.ipc.on('system:graceful:force', function() {
// 			console.log('Got graceful for for process '+process.pid);
// 			process.exit(0);
// 		});
// 	}
// 	
// 	/* add graceful receiver */
// 	bs.lib.bsCore.ipc.on('system:graceful:process', gracefulReceiver);
// 		
// 		
// 	return(false);
	
}

module.exports = forward;

