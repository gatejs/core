/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Associative Cache Network service [http://www.binarysec.com]
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

var net = require("net");
var cluster = require("cluster");
var dgram = require('dgram');
var crypto = require('crypto');
var url = require('url');
var fs = require('fs');
var http = require('http');
var events = require('events');
var eventEmitter = new events.EventEmitter();

var highestLatency = 0;
var serverTable = {};
var ballTable = {}; 

var acnService = function(gjs) { /* loader below */ };

acnService.loader = function(gjs) {
	
	/* bind Events */
	for(var a in eventEmitter)
		acnService[a] = eventEmitter[a];
	
	if(!gjs.serverConfig.acn)
		return;
	
	var a = gjs.serverConfig.acn;

	a.listen = a.listen ? a.listen : '0.0.0.0';
	a.port = a.port ? a.port : 9043;
	
	if(!cluster.isMaster) {
		loadSlaveAPI(gjs);
		loadTCPReplier(gjs);
	}
	
	if(gjs.serverConfig.acn instanceof Object) {
		if(a.mode == 'multicast') {
			
			a.address = a.address ? a.address : '224.0.0.174';
			a.deadInterval = a.deadInterval ? a.deadInterval : 2000;
			a.pingInterval = a.pingInterval ? a.pingInterval : 200;
			a.deadRequest = a.deadRequest ? a.deadRequest : 50;
			loadMulticastACN(gjs);
		}
	}
}

function loadTCPReplier(gjs) {
	var a = gjs.serverConfig.acn;
	
	
	var iface = http.createServer();
	
	iface.on('connection', function (socket) {
		
	});

	iface.on('request', function(request, response) {
		
		
		try {
			request.urlParse = url.parse(request.url, true);
		} catch(e) {
			gjs.lib.core.logger.error("ACN URL Parse error on "+request.path+' from '+request.connection.remoteAddress);
			
			response.writeHead(403, { server: 'gatejs'});
			response.end();
		
			return;
		}
		
		var fileHash = request.urlParse.query.fileHash;
		if(!fileHash || fileHash.length < 10) {
			response.writeHead(403, { server: 'gatejs'});
			response.end();
		
			return;
		}
		
		var hash = gjs.lib.acn.divideHash(gjs, fileHash);
		var headers = gjs.lib.acn.loadHeaderFile(hash.file);
		
		if(!headers) {
			response.writeHead(404, { server: 'gatejs'});
			response.end();
			return(false);
		}
		
		if(headers.needDump == false) {
			/* check stale */
			var isF = gjs.lib.acn.isFresh(headers);
			if(isF == false) {
				response.writeHead(404, { server: 'gatejs'});
				response.end();
				return(false);
			}
			
			/*
			 * Manage the 304 not stupuflux
			 */
			if(
				(request.headers['if-modified-since'] &&
				headers.headers['last-modified'] == request.headers['if-modified-since']) ||
				(request.headers['if-none-match'] &&
				headers.headers.etag == request.headers['if-none-match'])
				) {

				delete headers.headers['content-type'];
				delete headers.headers['last-modified'];
				delete headers.headers['content-encoding'];
				delete headers.headers['content-length'];

				/* load headers */
				for(var n in headers.headers)
					response.gjsSetHeader(n, headers.headers[n]);
				
// 				gjs.lib.core.ipc.send('LFW', 'bsStatus', {
// 					host: request.headers.host,
// 					hits: true
// 				});
				
				response.bsCache = 'hit';

				/* fix headers */
				var nHeaders = {};
				for(var n in response.headers)
					nHeaders[response.orgHeaders[n]] = response.headers[n];
			
				response.writeHead(304, nHeaders);
				response.end();
				
				return(true);
			}

			/*
			 * Dump the file as 200 response
			 */
			
			/* load headers */
			for(var n in headers.headers)
				response.gjsSetHeader(n, headers.headers[n]);
			
			/* fix headers */
			var nHeaders = {};
			for(var n in response.headers)
				nHeaders[response.orgHeaders[n]] = response.headers[n];
				
			response.writeHead(200, nHeaders);
			var st = fs.createReadStream(hash.file, {
				start: headers.headerSerialPos
			});

// 			gjs.root.lib.bsCore.ipc.send('LFW', 'bsStatus', {
// 				host: gjs.request.headers.host,
// 				hits: true
// 			});
			
			response.bsCache = 'hit';
			
			st.pipe(response);
			
			return(true);
		}

		response.writeHead(404, { server: 'gatejs'});
		response.end();
		return(false);
	});
	
	iface.listen(a.port, a.listen);
}


function loadSlaveAPI(gjs) {
	var requestTable = {};
	
	gjs.lib.acn.hashRequest = function(pipe) {
		var inHash;
		if(pipe.request.urlParseCacheStore)
			inHash = url.format(pipe.request.urlParseCacheStore);
		else
			inHash = pipe.request.headers.host+url.format(pipe.request.urlParse);

		var hash = gjs.lib.acn.generateInHash(pipe.root, inHash);
		
		return(hash);
	}

	gjs.lib.acn.askDigest = function(pipe, func) {
		
// 		if(highestLatency <= 0) {
// 			func.apply(null, [true, 'not ready']);
// 			return;
// 		}
		
		var inHash;
		if(pipe.request.urlParseCacheStore)
			inHash = url.format(pipe.request.urlParseCacheStore);
		else
			inHash = pipe.request.headers.host+url.format(pipe.request.urlParse);
		
		var rnd = Math.random();
		
		var msg = {
			id: rnd,
			inHash: inHash,
			encoding: pipe.request.headers['accept-encoding']
		};
		
		requestTable[rnd] = msg;
		gjs.lib.core.ipc.send('LFW', 'askDigest', msg);
		
		requestTable[rnd].func = func;
		requestTable[rnd].timeout = setTimeout(function() {
			func.apply(null, [true, 'timeout']);
			delete requestTable[rnd];
			return;
		}, gjs.serverConfig.acn.deadRequest > 5 ? gjs.serverConfig.acn.deadRequest : 5);
	}

	gjs.lib.acn.pushDigest = function(pipe, hashObject) {
// 		console.log(hashObject);
	}
	
	gjs.lib.acn.popDigest = function(pipe) {
		
	}
	
	setTimeout(function() {
		/* update slave latency */
		gjs.lib.core.ipc.on('acnHighLatency', function(p, jdata) {
			highestLatency = jdata.msg.latency;
		});
		
		/* update slave latency */
		gjs.lib.core.ipc.on('acnReply', function(p, jdata) {
			var ptr = requestTable[jdata.msg.data.id];
			if(ptr) {
				clearTimeout(ptr.timeout);
				ptr.func.apply(null, [false, jdata.msg]);
				delete requestTable[jdata.msg.data.id];
			}
		});
	}, 1000);

}


function loadMulticastACN(gjs) {
	if(!cluster.isMaster)
		return;
	
	acnService.server = dgram.createSocket("udp4");

	acnService.server.on("error", function (err) {
		gjs.lib.core.logger.error("ACN server error:\n" + err.stack);
		acnService.server.close();
	});

	acnService.send = function(data, rinfo) {
		var dst = gjs.serverConfig.acn.address;
		if(rinfo)
			dst = rinfo.address;
	
		data.node = gjs.serverConfig.hostname;
		var buf = new Buffer(JSON.stringify(data)+"\n");
		acnService.server.send(buf, 0, buf.length, gjs.serverConfig.acn.port, dst, function(err, bytes) {
			if(err)
				gjs.lib.core.logger.error('Error sending ACN packet');
		});
	}
	
	
	function onMessage(msg, rinfo) {
		try {
			var jdata = JSON.parse(msg);
		} catch(e) {
			console.log(e);
			return;
		}
		if(jdata.node == gjs.serverConfig.hostname)
			return;
		if(jdata.cmd)
			acnService.emit(jdata.cmd, jdata, rinfo);
	}
	
	function onListening() {
		var address = acnService.server.address();
		gjs.lib.core.logger.system("ACN multicast service listening " +
			address.address + ":" + address.port);
		
		acnService.server.addMembership(gjs.serverConfig.acn.address, gjs.serverConfig.acn.listen);
		
		function sendHello() {
			var rnd = Math.random();
			ballTable[rnd] = new Date();
			var msg = {
				cmd: 'hello',
				id: rnd
			};
			acnService.send(msg);
		}
		
		function serverTableCheck() {
			var now = new Date();
			highestLatency = 0;
			for(var a in serverTable) {
				var s = serverTable[a];
				
				s.breakPoint = now.getTime()-s.last.getTime();

				if(s.breakPoint > highestLatency)
					highestLatency = s.breakPoint;

// 				console.log('Service node '+s.node+' break point is '+s.breakPoint+'ms');
			}

			gjs.lib.core.ipc.send('LFW', 'acnHighLatency', { latency: highestLatency });
		}

		acnService.on('hello', function(data, rinfo) {
			if(serverTable[data.node]) {
				clearTimeout(serverTable[data.node].timeout);
			}
			else
				gjs.lib.core.logger.system('ACN node '+data.node+' is now UP '+rinfo.address);
			
			serverTable[data.node] = {
				node: data.node,
				ip: rinfo.address,
				last: new Date(),
				timeout: setTimeout(function() {
					gjs.lib.core.logger.system('ACN node '+data.node+' is now DOWN '+rinfo.address);
					delete serverTable[data.node];
				}, gjs.serverConfig.acn.deadInterval)
			}
			
		});
		
		
		setInterval(sendHello, gjs.serverConfig.acn.pingInterval);
		setInterval(serverTableCheck, 1000);
		
		/* get remote ACN digest asks  */
		acnService.on('askDigest', function(data, rinfo) {
			
			if(data.msg.encoding) {
				var hae = data.msg.encoding.split(',');
				var a;
				for(a in hae) {
					var hash = gjs.lib.acn.generateInHash(0, data.msg.inHash+hae[a].trim());
					var headers = gjs.lib.acn.loadHeaderFile(hash.file);
					if(!headers)
						continue;
					
					if(headers.needDump == false) {
						/* check stale */
						var isF = gjs.lib.acn.isFresh(headers);
						if(isF == false)
							continue;
					}
			
					var msg = {
						cmd: 'answerDigest',
						id: data.msg.id,
						hash: hash.hash,
						found: true
					};
					acnService.send(msg, rinfo);
					return;
					
				}
			}
			
			
			var hash = gjs.lib.acn.generateInHash(0, data.msg.inHash);
			var headers = gjs.lib.acn.loadHeaderFile(hash.file);

			if(!headers)
				return;
			
			if(headers.needDump == false) {
				/* check stale */
				var isF = gjs.lib.acn.isFresh(headers);
				if(isF != false) {
					
					var msg = {
						cmd: 'answerDigest',
						id: data.msg.id,
						hash: hash.hash,
						found: true
					};
					acnService.send(msg, rinfo);
					return;
				}
			}

		
		
		});
		
		acnService.on('answerDigest', function(data, rinfo) {
			
			gjs.lib.core.ipc.send('LFW', 'acnReply', {data: data, rinfo: rinfo});
		});
		
		gjs.lib.core.ipc.on('askDigest', function(p, jdata) {
			var msg = {
				cmd: 'askDigest',
				msg: jdata.msg
			};
			acnService.send(msg);
		});
		
		gjs.lib.core.ipc.on('pushDigest', function(test) {
			
		});
	}
	
	acnService.server.on("message", onMessage);
	acnService.server.on("listening", onListening);

	if(gjs.serverConfig.acn.listen != '0.0.0.0') {
		acnService.subServer = dgram.createSocket("udp4");

		acnService.subServer.on("error", function (err) {
			acnService.subServer.close();
		});
		
		acnService.subServer.on("message", onMessage);
		acnService.subServer.bind(gjs.serverConfig.acn.port, gjs.serverConfig.acn.address)
	}
	
	
	acnService.server.bind(gjs.serverConfig.acn.port, gjs.serverConfig.acn.listen)
}


module.exports = acnService;


