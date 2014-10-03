/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Web server [http://www.binarysec.com]
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

var server = function() { /* loader below */ };

server.list = {};
server.sockets = [];

server.log = function(gjs, connClose) {
	if(!connClose)
		connClose = gjs.response.statusCode;
	
	gjs.root.lib.core.logger.commonLogger(
		'SRVLOG',
		{
			version: gjs.request.httpVersion,
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

server.logpipe = function(gjs, src) {
	if(!gjs.request.gjsWriteBytes)
		gjs.request.gjsWriteBytes = 0;
	
	/* accumulate counter */
	src.on('data', function(data) {
		gjs.request.gjsWriteBytes += data.length;
	});

	/* on client close connection */
	gjs.request.on('close', function() {
		server.log(gjs, 499);
	});
	
	/* on response sent to client */
	gjs.response.on('finish', function() {
		server.log(gjs);
	});
	src.pipe(gjs.response);
}

server.pipeline = [
	['scanFileOnDisk'],
	['directoryListing'],
	['checkHandler'],
	['streamFile'],
];

server.loader = function(gjs) {
	server.sites = new gjs.lib.http.site(gjs, 'pipeServer', 'serverSites');
	server.sites.reload();
	
	if (cluster.isMaster) {
		var logger = gjs.lib.core.logger;
		
		/* create logging receiver */
		var processLog = function(req) {
			var dateStr = gjs.lib.core.dateToStr(req.msg.time);

			var inline = 
				dateStr+' - '+
				req.msg.site+' - '+
				req.msg.ip+' '+
				req.msg.cache.toUpperCase()+' '+
				req.msg.method+' '+
				req.msg.code+' '+
				req.msg.url+' '+
				'"'+req.msg.userAgent+'" '+
				req.msg.outBytes+' '+
				req.msg.referer+' '
			;
			
			/* write log */
			var f = logger.selectFile(null, 'server-access');
			if(f) 
				f.stream.write(inline+'\n');
		}
		
		logger.typeTab['SRVLOG'] = processLog;
		return;
	}
	

	var processRequest = function(inter, request, response) {
		request.remoteAddress = request.connection.remoteAddress;
	
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
		pipe.server = true;
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
		var iface = server.list[inter.gjsKey];
		if(!iface) {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 500, 
				tpl: "5xx", 
				log: false,
				title:  "Internal server error",
				explain: "no iface found, fatal error"
			});
			gjs.lib.core.logger.error('No interface found for key '+inter.gjsKey+' from '+request.remoteAddress);
			return;
		}
		pipe.iface = iface;
		
		/* lookup website */
		pipe.site = server.sites.search(request.headers.host);
		if(!pipe.site) {
			pipe.site = server.sites.search('_');
			if(!pipe.site) {
				gjs.lib.http.error.renderArray({
					pipe: pipe, 
					code: 404, 
					tpl: "4xx", 
					log: false,
					title:  "Not found",
					explain: "No default website"
				});
				return;
			}
		}
	
		/* scan regex */
		pipe.location = false;
		if(pipe.site.locations) {
			for(var a in pipe.site.locations) {
				var s = pipe.site.locations[a];
				if(!s.regex)
					s.regex = /.*/;
				if(s.regex.test(request.url)) {
					pipe.location = s;
					break;
				}
			}
		}
		if(pipe.location == false) {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 500, 
				tpl: "5xx", 
				log: false,
				title:  "Internal server error",
				explain: "No locations found for this website"
			});
			return;
		}

		pipe.update(server.opcodes, server.pipeline);
		
		/* execute pipeline */
		pipe.resume();
		pipe.execute();
	};
	
	var bindHttpServer = function(key, sc) {
		var iface = http.createServer(function(request, response) {
			request.connection.inUse = true;

			response.on('finish', function() {
				if(request.connection._handle)
					request.connection.inUse = false;
			});
			
			processRequest(this, request, response);
			
		});
		
		iface.on('connection', (function(socket) {
			gjs.lib.core.graceful.push(socket);
			gjs.lib.core.stats.diffuse('httpWaiting', gjs.lib.core.stats.action.add, 1);
			
			socket.setTimeout(60000);
			
			socket.on('close', function () {
				socket.inUse = false;
				gjs.lib.core.graceful.release(socket);
				gjs.lib.core.stats.diffuse('httpWaiting', gjs.lib.core.stats.action.sub, 1);
			});
		}));
		
		iface.on('listening', function() {
			gjs.lib.core.logger.system("Binding HTTP server on "+sc.address+":"+sc.port);
			iface.working = true;
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTP server error for instance '+key+': '+e);
			console.log('* HTTPS server error for instance '+key+': '+e);
		});
		
		iface.gjsKey = key;
		iface.allowHalfOpen = false;
		iface.config = sc;
		iface.listen(sc.port, sc.address);
		
		return(iface);
	}
	
	
	var bindHttpsServer = function(key, sc) {
		if(!lookupSSLFile(sc)) {
			console.log("Can not create HTTPS server on "+sc.address+':'+sc.port);
			return(false);
		}
		
// 		sc.SNICallback = function(hostname) {
// 			var sites = reverse.list[key].sites;
// 			var site = lookupServername(sites, hostname);
// 			if(site && site.sslSNI) {
// 				/* can not use SNI  */
// 				if(site.sslSNI.usable == false)
// 					return(false);
// 				
// 				/* SNI resolved */
// 				if(site.sslSNI.resolv)
// 					return(site.sslSNI.crypto.context);
// 				
// 				/* ok wegjsite has SNI certificate check files */
// 				if(!lookupSSLFile(site.sslSNI)) {
// 					site.sslSNI.usable = false;
// 					site.sslSNI.resolv = true;
// 					return(false);
// 				}
// 				site.sslSNI.usable = true;
// 				site.sslSNI.resolv = true;
// 				
// 				/* associate crypto Credentials */
// 				site.sslSNI.crypto = crypto.createCredentials(site.sslSNI);
// 				return(site.sslSNI.crypto.context);
// 			}
// 		}
		
		var iface = https.createServer(sc, function(request, response) {
			request.connection.inUse = true;

			response.on('finish', function() {
				if(request.connection._handle)
					request.connection.inUse = false;
			});
			
			processRequest(this, request, response);
			
		});
		
		
		iface.on('connection', (function(socket) {
			gjs.lib.core.graceful.push(socket);
			
			socket.setTimeout(60000);
			
			socket.on('close', function () {
				socket.inUse = false;
				gjs.lib.core.graceful.release(socket);
			});
		}));
		
		iface.on('listening', function() {
			gjs.lib.core.logger.system("Binding HTTPS reverse proxy on "+sc.address+":"+sc.port);
			iface.working = true;
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTPS reverse error for instance '+key+': '+e);
			console.log('* HTTPS server error for instance '+key+': '+e);
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
		if(o.type == 'server') {
			var r = bindHttpServer(key, o);
			if(r != false)
				server.list[key] = r;
		}
	}
	
	/* Load opcode context */
	server.opcodes = gjs.lib.core.pipeline.scanOpcodes(
		__dirname+'/pipeServer',
		'pipeServer'
	);
	if(!server.opcodes)
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
		for(var a in server.list) {
			var s = server.list[a];
			if(s.working == true) {
				s.isClosing = true;
				s.close(function() { });
			}
		}
		
		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
	}
	
	/* add graceful receiver */
	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);
		
	return(false);
	
}

module.exports = server;

