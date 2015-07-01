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
var tls = require("tls");

var spdy = require("./node-spdy/lib/spdy.js");

var reverse = function() { /* loader below */ };

reverse.list = {};

reverse.log = function(gjs, connClose) {
	if(!connClose)
		connClose = gjs.response.statusCode;
	
	var version;
	if(gjs.request.isSpdy)
		version = "SPDY/"+gjs.request.spdyVersion;
	else
		version = "HTTP/"+gjs.request.httpVersion;
		
	
	gjs.root.lib.core.logger.commonLogger(
		'RVLOG',
		{
			version: version,
			site: gjs.site.name ? gjs.site.name : 'default',
			ip: gjs.request.remoteAddress,
			code: connClose,
			method: gjs.request.method,
			url: gjs.request.url,
			outBytes: gjs.request.gjsWriteBytes ? gjs.request.gjsWriteBytes : '0',
			userAgent: gjs.request.headers['user-agent'] ? gjs.request.headers['user-agent'] : '-',
			referer: gjs.request.headers.referer ? gjs.request.headers.referer : '-',
			cache: gjs.response.gjsCache ? gjs.response.gjsCache : 'miss',
			logAdd: gjs.logAdd
		}
	);
}

reverse.error = function(gjs, error) {
	var version;
	if(gjs.request.isSpdy)
		version = "SPDY/"+gjs.request.spdyVersion;
	else
		version = "HTTP/"+gjs.request.httpVersion;
	
	gjs.root.lib.core.logger.commonLogger(
		'RVERR',
		{
			version: version,
			site: gjs.site.name ? gjs.site.name : 'default',
			ip: gjs.request.remoteAddress,
			method: gjs.request.method,
			url: gjs.request.url,
			userAgent: gjs.request.headers['user-agent'] ? gjs.request.headers['user-agent'] : '-',
			referer: gjs.request.headers.referer ? gjs.request.headers.referer : '-',
			message: error,
			logAdd: gjs.logAdd
		}
	);
}

reverse.logpipe = function(gjs, src) {
	if(!gjs.request.gjsWriteBytes)
		gjs.request.gjsWriteBytes = 0;
	
	/* accumulate counter */
	src.on('data', function(data) {
		gjs.request.gjsWriteBytes += data.length;
	});

	/* on client close connection */
	gjs.request.on('close', function() {
		reverse.log(gjs, 499);
	});
	
	/* on response sent to client */
	gjs.response.on('finish', function() {
		reverse.log(gjs);
	});
	src.pipe(gjs.response);
}

reverse.loader = function(gjs) {
	reverse.sites = new gjs.lib.http.site(gjs, 'pipeReverse', 'reverseSites');
	reverse.sites.reload();
	
	if (cluster.isMaster) {
		/* background checker */
		reverse.sitesFaulty = {};
		
		function backgroundChecker(input) {
			var node = input.msg.node;
			var options = {
				host: node.host,
				port: node.port,
				path: '/',
				method: 'GET',
				headers: {
					Host: input.msg.site,
					"User-Agent": "gatejs monitor"
				},
				rejectUnauthorized: false,
				servername: input.msg.site,
				agent: false
			};
			
			var flowSelect = http;
			if(node.https == true)
				flowSelect = https;
			
			var context = reverse.sitesFaulty[input.hash];
			var subHash = input.site.confName+node._name+node._key+node._index;

			var req = flowSelect.request(options, function(res) {
				
				for(var a in context) {
					var b = context[a];
					if(a.substr(0, 1) != '_') {
						gjs.lib.core.ipc.send('LFW', 'proxyPassWork', {
							site: b._site,
							node: b
						});
					}
				}
				
				clearTimeout(res.socket.timeoutId);
				delete reverse.sitesFaulty[input.hash];
			});
			
			req.on('error', function (error) {
			});

			function socketErrorDetection(socket) {
				req.abort();
				socket.destroy();
				clearTimeout(socket.timeoutId); 
				context._timer = setTimeout(
					backgroundChecker,
					1000,
					input
				);
			}
			
			req.on('socket', function (socket) {
				socket.timeoutId = setTimeout(
					socketErrorDetection, 
					10000, 
					socket
				);
				socket.on('connect', function() {
					clearTimeout(socket.timeoutId); 
				});
			});
			req.end();
		
		}
		
		gjs.lib.core.ipc.on('proxyPassFaulty', function(gjs, data) {
			var d = data.msg.node;
			var s = reverse.sites.search(data.msg.site);
			if(!s)
				return;
			
			/* group by ip and port */
			var hash = d.host+':'+d.port;
			if(!reverse.sitesFaulty[hash]) {
				reverse.sitesFaulty[hash] = {
					_host: d.host,
					_port: d.port,
					_timer: setTimeout(
						backgroundChecker,
						2000,
						{hash: hash, msg: data.msg, site: s }
					)
				};
			}
			var context = reverse.sitesFaulty[hash];
			var subHash = s.confName+d._name+d._key+d._index;
			if(context[subHash])
				return;
			var siteHash = context[subHash] = d;
			
			siteHash._site = data.msg.site;
		});

		/* Logging */
		var logger = gjs.lib.core.logger;
		
		/* create logging receiver */
		var processLog = function(req) {
			
			var logAdd = req.msg.logAdd ? req.msg.logAdd : ''; 
			var inline = 
				req.msg.site+' - '+
				req.msg.ip+' '+
				req.msg.version+' '+
				req.msg.cache.toUpperCase()+' '+
				req.msg.method+' '+
				req.msg.code+' '+
				req.msg.url+' '+
				'"'+req.msg.userAgent+'" '+
				req.msg.outBytes+' '+
				req.msg.referer+
				logAdd
			;
			
			/* write log */
			var f = logger.selectFile(req.msg.site, 'access');
			if(f) 
				f.write(inline);
		}
		var processError = function(req) {
			/* write log */
			var f = logger.selectFile(req.msg.site, 'error');
			if(f) 
				f.write(req.msg.message);
		}
		
		logger.typeTab['RVLOG'] = processLog;
		logger.typeTab['RVERR'] = processError;
		return;
	}
	
	var processRequest = function(server, request, response) {
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
		
		pipe.logAdd = '';
		pipe.reverse = true;
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
		
		/* lookup website */
		pipe.site = reverse.sites.search(request.headers.host);
		if(!pipe.site) {
			pipe.site = reverse.sites.search('_');
			if(!pipe.site) {
				pipe.response.end();
				/*
				gjs.lib.http.error.renderArray({
					pipe: pipe, 
					code: 404, 
					tpl: "4xx", 
					log: false,
					title:  "Not found",
					explain: "No default website"
				});
				*/
				return;
			}
		}
		
		/* lookup little FS */
		var lfs = gjs.lib.http.littleFs.process(pipe);
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
		if(!pipe.location.pipeline instanceof Array) {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 500, 
				tpl: "5xx", 
				log: false,
				title:  "Internal server error",
				explain: "Invalid pipeline format for this website"
			});
			return;
		}

		pipe.update(reverse.sites.opcodes, pipe.location.pipeline);
		
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
		var iface = http.createServer(function(request, response) {
			request.connection.inUse = true;

			response.on('finish', function() {
				if(request.connection._handle)
					request.connection.inUse = false;
			});
			
			processRequest(this, request, response);
			
		});
		
		iface.gjsKey = key;
		iface.allowHalfOpen = false;
		iface.config = sc;
		
		/* select agent */
		if(sc.isTproxy == true)
			iface.agent = gjs.lib.http.agent.httpTproxy;
		else
			iface.agent = gjs.lib.http.agent.http;
		
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
			gjs.lib.core.logger.system("Binding HTTP reverse proxy on "+sc.address+":"+sc.port);
			iface.working = true;
		});
		
		iface.on('error', function(e) {
			gjs.lib.core.logger.error('HTTP reverse error for instance '+key+': '+e);
			console.log('* HTTP reverse error for instance '+key+': '+e);
		});
		
		/* listen */
		if(sc.isTproxy == true)
			iface.listenTproxy(sc.port, sc.address);
		else
			iface.listen(sc.port, sc.address);
			
		return(iface);
	}
	

	var bindHttpsServer = function(key, sc) {
		if(!gjs.lib.http.lookupSSLFile(sc)) {
			console.log("Can not create HTTPS server on "+sc.address+':'+sc.port);
			return(false);
		}
		
		gjs.lib.http.hardeningSSL(sc);

		sc.SNICallback = function(hostname, cb) {
			
			var site = reverse.sites.search(hostname);
			
			if(site && site.sslSNI) {
				/* can not use SNI  */
				if(site.sslSNI.usable == false)
					return(false);
		
				/* SNI resolved */
				if(site.sslSNI.resolv)
					return(site.sslSNI.crypto.context);
				
				/* ok wegjsite has SNI certificate check files */
				if(!gjs.lib.http.lookupSSLFile(site.sslSNI)) {
					site.sslSNI.usable = false;
					site.sslSNI.resolv = true;
					return(false);
				}
				site.sslSNI.usable = true;
				site.sslSNI.resolv = true;
				
				gjs.lib.http.hardeningSSL(site.sslSNI);
				
				/* associate crypto Credentials */
				site.sslSNI.crypto = tls.createSecureContext(site.sslSNI);
				
				/* set TLS context */ 
				cb(null, site.sslSNI.crypto.context);
				return(true);
			}
		}

		sc.spdy = false;
		
		var int = https;
		if(sc.spdy == true) 
			int = spdy;
		
		var iface = int.createServer(sc, function(request, response) {
			request.connection.inUse = true;

			response.on('finish', function() {
				if(request.connection._handle)
					request.connection.inUse = false;
			});
			
			processRequest(this, request, response);
			
		});
		
		iface.gjsKey = key;
		iface.allowHalfOpen = false;
		iface.config = sc;
		
		/* select agent */
		if(sc.spdy == true) {
			if(sc.isTproxy == true)
				iface.agent = gjs.lib.http.agent.spdyTproxy;
			else
				iface.agent = gjs.lib.http.agent.spdy;
		}
		else if(sc.isTproxy == true)
			iface.agent = gjs.lib.http.agent.httpsTproxy;
		else
			iface.agent = gjs.lib.http.agent.https;
		
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
			console.log('* HTTPS reverse error for instance '+key+': '+e);
		});
	
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
		console.log('Process receive graceful message');
		for(var a in reverse.list) {
			var config = reverse.list[a];
		
			/* close all server accept */
			for(var b in config.ifaces) {
				var server = config.ifaces[b];
				if(server.working == true) {
					server.isClosing = true;
					server.close(function() { });
				}
			}
		}
		
		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
	}
	
	/* add graceful receiver */
	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);
	
	return(false);
	
}

module.exports = reverse;

