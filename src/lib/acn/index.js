/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Associative Cache Network [http://www.binarysec.com]
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

var acn = function(bs) { /* loader below */ };

acn.loader = function(bs) {
	acn.cacheDir = bs.serverConfig.dataDir+"/cache/";
	
	/* bind Events */
	for(var a in eventEmitter)
		acn[a] = eventEmitter[a];
	
	if(!bs.serverConfig.acn)
		return;
	
	var a = bs.serverConfig.acn;

	a.listen = a.listen ? a.listen : '0.0.0.0';
	a.port = a.port ? a.port : 9043;
	
	if(!cluster.isMaster) {
		loadSlaveAPI(bs);
		loadTCPReplier(bs);
	}
	
	if(bs.serverConfig.acn instanceof Object) {
		if(a.mode == 'multicast') {
			
			a.address = a.address ? a.address : '224.0.0.174';
			a.deadInterval = a.deadInterval ? a.deadInterval : 2000;
			a.pingInterval = a.pingInterval ? a.pingInterval : 200;
			a.deadRequest = a.deadRequest ? a.deadRequest : 50;
			loadMulticastACN(bs);
		}
	}
}

function loadTCPReplier(bs) {
	var a = bs.serverConfig.acn;
	
	
	var iface = http.createServer();
	
	iface.on('connection', function (socket) {
		
	});

	iface.on('request', function(request, response) {
		
		
		try {
			request.urlParse = url.parse(request.url, true);
		} catch(e) {
			bs.lib.core.logger.error("ACN URL Parse error on "+request.path+' from '+request.connection.remoteAddress);
			
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
		
		var hash = acn.divideHash(bs, fileHash);
		var headers = acn.loadHeaderFile(hash.file);
		
		if(!headers) {
			response.writeHead(404, { server: 'gatejs'});
			response.end();
			return(false);
		}
		
		if(headers.needDump == false) {
			/* check stale */
			var isF = acn.isFresh(headers);
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

// 				bs.lib.core.ipc.send('LFW', 'bsStatus', {
// 					host: request.headers.host,
// 					hits: true
// 				});
				
				response.bsCache = 'hit';

				/* fix headers */
				var nHeaders = {};
				for(var n in headers.headers)
					nHeaders[bs.lib.core.fixCamelLike(n)] = headers.headers[n];
				
				response.writeHead(304, nHeaders);
				response.end();
				
				return(true);
			}

			/*
			 * Dump the file as 200 response
			 */
			/* fix headers */
			var nHeaders = {};
			for(var n in headers.headers)
				nHeaders[bs.lib.core.fixCamelLike(n)] = headers.headers[n];
				
			response.writeHead(200, nHeaders);
			var st = fs.createReadStream(hash.file, {
				start: headers.headerSerialPos
			});

// 			bs.root.lib.bsCore.ipc.send('LFW', 'bsStatus', {
// 				host: bs.request.headers.host,
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


function loadSlaveAPI(bs) {
	var requestTable = {};
	
	acn.hashRequest = function(pipe) {
		var inHash;
		if(pipe.request.urlParseCacheStore)
			inHash = url.format(pipe.request.urlParseCacheStore);
		else
			inHash = pipe.request.headers.host+url.format(pipe.request.urlParse);

		var hash = acn.generateInHash(pipe.root, inHash);
		
		return(hash);
	}

	acn.askDigest = function(pipe, func) {
		
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
		bs.lib.core.ipc.send('LFW', 'askDigest', msg);
		
		requestTable[rnd].func = func;
		requestTable[rnd].timeout = setTimeout(function() {
			func.apply(null, [true, 'timeout']);
			delete requestTable[rnd];
			return;
		}, bs.serverConfig.acn.deadRequest > 5 ? bs.serverConfig.acn.deadRequest : 5);
	}

	acn.pushDigest = function(pipe, hashObject) {
// 		console.log(hashObject);
	}
	
	acn.popDigest = function(pipe) {
		
	}
	
	setTimeout(function() {
		/* update slave latency */
		bs.lib.core.ipc.on('acnHighLatency', function(p, jdata) {
			highestLatency = jdata.msg.latency;
		});
		
		/* update slave latency */
		bs.lib.core.ipc.on('acnReply', function(p, jdata) {
			var ptr = requestTable[jdata.msg.data.id];
			if(ptr) {
				clearTimeout(ptr.timeout);
				ptr.func.apply(null, [false, jdata.msg]);
				delete requestTable[jdata.msg.data.id];
			}
		});
	}, 1000);

}


function loadMulticastACN(bs) {
	if(!cluster.isMaster)
		return;
	
	acn.server = dgram.createSocket("udp4");

	acn.server.on("error", function (err) {
		bs.lib.core.logger.error("ACN server error:\n" + err.stack);
		acn.server.close();
	});

	acn.send = function(data, rinfo) {
		var dst = bs.serverConfig.acn.address;
		if(rinfo)
			dst = rinfo.address;
	
		data.node = bs.serverConfig.hostname;
		var buf = new Buffer(JSON.stringify(data)+"\n");
		acn.server.send(buf, 0, buf.length, bs.serverConfig.acn.port, dst, function(err, bytes) {
			if(err)
				bs.lib.core.logger.error('Error sending ACN packet');
		});
	}
	
	
	function onMessage(msg, rinfo) {
		try {
			var jdata = JSON.parse(msg);
		} catch(e) {
			console.log(e);
			return;
		}
		if(jdata.node == bs.serverConfig.hostname)
			return;
		if(jdata.cmd)
			acn.emit(jdata.cmd, jdata, rinfo);
	}
	
	function onListening() {
		var address = acn.server.address();
		bs.lib.core.logger.system("ACN multicast service listening " +
			address.address + ":" + address.port);
		
		acn.server.addMembership(bs.serverConfig.acn.address, bs.serverConfig.acn.listen);
		
		function sendHello() {
			var rnd = Math.random();
			ballTable[rnd] = new Date();
			var msg = {
				cmd: 'hello',
				id: rnd
			};
			acn.send(msg);
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

			bs.lib.core.ipc.send('LFW', 'acnHighLatency', { latency: highestLatency });
		}

		acn.on('hello', function(data, rinfo) {
			if(serverTable[data.node]) {
				clearTimeout(serverTable[data.node].timeout);
			}
			else
				bs.lib.core.logger.system('ACN node '+data.node+' is now UP '+rinfo.address);
			
			serverTable[data.node] = {
				node: data.node,
				ip: rinfo.address,
				last: new Date(),
				timeout: setTimeout(function() {
					bs.lib.core.logger.system('ACN node '+data.node+' is now DOWN '+rinfo.address);
					delete serverTable[data.node];
				}, bs.serverConfig.acn.deadInterval)
			}
			
		});
		
		
		setInterval(sendHello, bs.serverConfig.acn.pingInterval);
		setInterval(serverTableCheck, 1000);
		
		/* get remote ACN digest asks  */
		acn.on('askDigest', function(data, rinfo) {
			
			if(data.msg.encoding) {
				var hae = data.msg.encoding.split(',');
				var a;
				for(a in hae) {
					var hash = acn.generateInHash(0, data.msg.inHash+hae[a].trim());
					var headers = acn.loadHeaderFile(hash.file);
					if(!headers)
						continue;
					
					if(headers.needDump == false) {
						/* check stale */
						var isF = acn.isFresh(headers);
						if(isF == false)
							continue;
					}
			
					var msg = {
						cmd: 'answerDigest',
						id: data.msg.id,
						hash: hash.hash,
						found: true
					};
					acn.send(msg, rinfo);
					return;
					
				}
			}
			
			
			var hash = acn.generateInHash(0, data.msg.inHash);
			var headers = acn.loadHeaderFile(hash.file);

			if(!headers)
				return;
			
			if(headers.needDump == false) {
				/* check stale */
				var isF = acn.isFresh(headers);
				if(isF != false) {
					
					var msg = {
						cmd: 'answerDigest',
						id: data.msg.id,
						hash: hash.hash,
						found: true
					};
					acn.send(msg, rinfo);
					return;
				}
			}

		
		
		});
		
		acn.on('answerDigest', function(data, rinfo) {
			
			bs.lib.core.ipc.send('LFW', 'acnReply', {data: data, rinfo: rinfo});
		});
		
		bs.lib.core.ipc.on('askDigest', function(p, jdata) {
			var msg = {
				cmd: 'askDigest',
				msg: jdata.msg
			};
			acn.send(msg);
		});
		
		bs.lib.core.ipc.on('pushDigest', function(test) {
			
		});
	}
	
	acn.server.on("message", onMessage);
	acn.server.on("listening", onListening);

	if(bs.serverConfig.acn.listen != '0.0.0.0') {
		acn.subServer = dgram.createSocket("udp4");

		acn.subServer.on("error", function (err) {
			acn.subServer.close();
		});
		
		acn.subServer.on("message", onMessage);
		acn.subServer.bind(bs.serverConfig.acn.port, bs.serverConfig.acn.address)
	}
	
	
	acn.server.bind(bs.serverConfig.acn.port, bs.serverConfig.acn.listen)
}


acn.divideHash = function(d, hash) {
	var fileHash = acn.cacheDir;
// 	if(!d || d <= 0 || d >= 10)
		d = 8;
	
	var dig = hash;
	var div = (dig.length-1) / d + 1;
	div = div|0;
	fileHash = fileHash + '/' + dig.substr(0, 1) + '/' + dig.substr(1, div - 1);
	for(var a=div; a<dig.length; a+=div)
		fileHash = fileHash + '/' + dig.substr(a, div);
	return({
		file: fileHash,
		hash: hash,
		tmpFile: acn.cacheDir + '/' + dig.substr(0, 1) + '/proxy/' + Math.random()
	});
}

acn.generateInHash = function(division, input) {
	var hash = crypto.createHash('md5');
	hash.update(input, 'ascii')
	return(acn.divideHash(division, hash.digest('hex')));
}

acn.loadHeaderFile = function(file) {
	try {
		var fd = fs.openSync(file, 'r'),
		readBuffer = new Buffer(5000),
		headerSerial = new  Buffer(5000),
		headerSerialPos = 0,
		nbytes,
		tbytes = 0,
		found = false;

		do {
		inBytes = 0;
		nbytes = fs.readSync(fd, readBuffer, 0, 100, null);
		for(var a = 0; a<nbytes; a++) {
			headerSerial[headerSerialPos] = readBuffer[a];
			headerSerialPos++;
			if(readBuffer[a] == 10) {
			found = true;
			break;
			}
		}
		tbytes += nbytes;
		if(nbytes == 0 || found == true)
			break;

		/* can not find */
		if(tbytes >= 5000) {
			console.log("warning file "+file+" seems to have a very big header. deleting. ");
			fs.closeSync(fd);
			fs.unlinkSync(file);
			return(false);
		}
		} while(1);


	} catch(e) {
		if(e.errno != 34)
		console.log(e);

		return(false);
	}
	fs.closeSync(fd);

	
	try {
		var headers = JSON.parse(headerSerial.toString('utf-8', 0, headerSerialPos));
		headers.headerSerialPos = headerSerialPos;
		return(headers);
	} catch(e) {
		return(false);
	}
	return(false);
}

acn.isFresh = function(hdr, maxAge) {
	var date = new Date;
	if(!maxAge) {
		
		if(hdr.headers['content-type']) {
			if(hdr.headers['content-type'].match(/text/))
				maxAge = 0;
			else if(hdr.headers['content-type'].match(/javascript/))
				maxAge = 800;
			else
				maxAge = 120000;
		}
		else
			maxAge = 120000;
	}
	/*
	* Check the cache control timer
	*/
	if(hdr.ccMaxAge > 0)
		maxAge = hdr.ccMaxAge;
	
	var currentAge = (date.getTime()-hdr.cacheTimer)/1000;
	if(currentAge > maxAge)
		return(false);

	return(true);
}


module.exports = acn;


