/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Reverse proxy proxyPass opcode [http://www.binarysec.com]
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

var util = require("util");
var http = require("http");
var https = require("https");
var events = require('events');

var proxyPass = function() {} 

proxyPass.request = function(pipe, proxyname) {

	/* lookup proxy stream */
	if(!pipe.site.proxyStream && !pipe.site.proxyStream[proxyname]) {
		gjs.lib.http.error.renderArray({
			pipe: pipe, 
			code: 500, 
			tpl: "5xx", 
			log: false,
			title:  "Internal server error",
			explain: "No proxyStream defined for the website"
		});
		return(true);
	}
	var proxyStream = pipe.site.proxyStream[proxyname];
	
	/* 
	 * select destination host by rr/iphash 
	 */
	function selectDestination(key) {
		var ret,
			node,
			nodePtr, rkey;
		
		var rkey = key+'Ctx';
		var reverse = proxyStream[key];
		var base = proxyStream[rkey] ? proxyStream[rkey] : proxyStream[rkey] = {};
			
		/* no current stream */
		if(!base.currentStream)
			base.currentStream = 0;
		
		/* check current stream if we can use it */
		nodePtr = reverse[base.currentStream];
		if(!nodePtr) {
			pipe.root.lib.http.error.renderArray({
				pipe: pipe, 
				code: 504, 
				tpl: "5xx", 
				log: true,
				title:  "Unknown proxy stream",
				explain: "No stream has been selected for "+proxyname
			});
		
			return(false);
		}
		
		/* weight */
		if(!nodePtr.currentWeight)
			nodePtr.currentWeight = 0;
		if(nodePtr.weight > nodePtr.currentWeight && nodePtr.isFaulty != true) {
			nodePtr.currentWeight++;
			return(nodePtr);
		}
			
		if(proxyStream.type == "rr") {
			/* check the nextone */
			if(reverse[base.currentStream+1])
				base.currentStream++;
			else
				base.currentStream = 0;
			
			/* check if the stream is usable */
			nodePtr = reverse[base.currentStream];
			if(nodePtr.isFaulty == true) {
				/* select another one */
				for(node in reverse) {
					var subNodePtr = reverse[node];
					if(subNodePtr.isFaulty != true) {
						base.currentStream = node;
						subNodePtr.currentWeight = 1;
						return(subNodePtr);
					}
				}
				
				return(false);
			}
			
			nodePtr.currentWeight = 1;
			return(nodePtr);
		}
		else if(proxyStream.type == "iphash") {
			var id = 0;
			if(gjs.request.remoteAddress) {
				var ipNums = gjs.request.remoteAddress.split(/[^0-9]+/).reverse();
				for(var i in ipNums)
					id ^= ipNums[i];
			}
			base.currentStream = id % base.reverse.length;
			
			/* check if the stream is usable */
			nodePtr = reverse[base.currentStream];
			if(nodePtr.isFaulty == true) {
				/* select another one */
				for(node in reverse) {
					var subNodePtr = reverse[node];
					if(subNodePtr.isFaulty != true) {
						base.currentStream = node;
						subNodePtr.currentWeight = 1;
						return(subNodePtr);
					}
				}
				
				return(false);
			}
			
			nodePtr.currentWeight = 1;
			return(nodePtr);
		}
	}
	
	function emitDestinationRequest(nodePtr) {
		if(!nodePtr.port)
			nodePtr.port = 80;
		
		/*
		* Prepare and emit the request
		*/
		var options = {
			host: nodePtr.host,
			port: nodePtr.port,
			path: pipe.request.url,
			method: pipe.request.method,
			headers: {},
			rejectUnauthorized: false,
			servername: pipe.request.headers.host
		};
		pipe.response.connector = nodePtr.host+":"+nodePtr.port;
		pipe.request.gjsOptions = options;
	
		for(var n in pipe.request.headers)
			options.headers[pipe.root.lib.core.fixCamelLike(n)] = pipe.request.headers[n];
		
		/* emit the preProxyPass */
		pipe.response.emit("proxyPassConnection", pipe, options);
		
		/* select flow control */
		var flowSelect = http;
		if(proxyStream.hybrid == true) {
			if(pipe.server.https == true)
				flowSelect = https;
			options.port = pipe.server.port;
		}
		else  {
			if(nodePtr.https == true)
				flowSelect = https;
		}
		
		var req = flowSelect.request(options, function(res) {

			/* abort connexion because someone is using it for a post response*/
			if(pipe.response.headerSent == true) {
				req.abort();
				return;
			}

			pipe.response.emit("proxyPassRequest", pipe, res);
			
// 			res.headers['x-binarysec-via']
// 			if(gjs.serverConfig.hostname)
// 				res.headers['x-binarysec-via'] = gjs.serverConfig.hostname;
// 			res.headers.server = 'BinarySEC';

			pipe.response.writeHead(res.statusCode, res.headers);
			pipe.response.headerSent = true;
// 			pipe.root.lib.bwsRg.httpServer.logpipe(gjs, res);
			res.pipe(pipe.response);
			
		});
		
		req.on('error', function (error) {
// 			gjs.root.lib.gjsCore.logger.siteInfo(
// 				gjs.request.selectedConfig.serverName[0], 
// 				"Proxy pass error on "+
// 				gjs.response.connector+" from "+
// 				gjs.request.connection.remoteAddress+
// 				":"+gjs.request.connection.remotePort+
// 				" with error code #"+error.code
// 			);
// 			
// 			/* for sure we can't deliver page */
// 			pipe.root.lib.http.error.renderArray({
// 				pipe: gjs, 
// 				code: 504, 
// 				tpl: "5xx", 
// 				log: true,
// 				title:  "Bad gateway",
// 				explain: "Unable to establish connection to the backend server "+error.code
// 			});
			console.log('tes');
			
		});

		function socketErrorDetection(socket) {

			gjs.root.lib.gjsCore.logger.siteInfo(
				gjs.request.selectedConfig.serverName[0], 
				"Proxy pass timeout on "+
				gjs.response.connector+" from "+
				gjs.request.connection.remoteAddress+
				":"+gjs.request.connection.remotePort
			);
			
			/* create background checker */
			if(!nodePtr.bgTimeoutId) {
				nodePtr.isFaulty = true;
				
				/* send IPC message to tell proxy doesn't work */
				gjs.root.lib.gjsCore.ipc.send('LFW', 'proxyPassTimeout', {
					proxyStreamName: gjs.request.selectedConfig.proxyStreamName,
					proxyname: proxyname,
					host: gjs.request.gjsOptions.hostname,
					port: gjs.request.gjsOptions.port,
					action: 'deferred'
				});
			
				if(!nodePtr.timeout)
					nodePtr.timeout = 30000;
			
				nodePtr.bgTimeoutId = setTimeout(
					backgroundChecker,
					2000,
					nodePtr,
					gjs.request.selectedConfig,
					proxyname
				);
			}
// 			else
// 				console.log('here is the bug');
			
			req.abort();
			
			/* can select another one ? */
			if(gjs.response.headerSent != true) {
				var a = selectDestination(proxyStream);
				if(a != false)
					emitDestinationRequest(a);
			}
		}
		
		req.on('socket', function (socket) {
// 			if(!nodePtr.timeout)
// 				nodePtr.timeout = 30000;
// 			socket.setTimeout(nodePtr.timeout, function() {
// 				socketErrorDetection(socket);
// 			});
// 			socket.on('connect', function() {
// 				socket.setTimeout(0);
// 			});
		});

		pipe.response.emit("proxyPassPrepare", req);
		pipe.pause();
		pipe.request.pipe(req);
		
	}


	/* select a destination */
	var nodePtr = selectDestination('primary');
	if(nodePtr == false) {
		var nodePtr = selectDestination('secondary');
		if(nodePtr == false) {
			/** \todo check for continue options */
			
			/* for sure we can't deliver page */
			pipe.root.lib.http.error.renderArray({
				pipe: pipe, 
				code: 504, 
				tpl: "5xx", 
				log: true,
				title:  "Bad gateway",
				explain: "Unable to establish connection to the backend server"
			});
			
			return(false);
		}
	}
	
	/* emit connection */
	var ret = emitDestinationRequest(nodePtr);
	
// 	console.log(nodePtr, ret);

// 	/* add real IP tracking */
// 	if(gjs.serverConfig.proxy && gjs.serverConfig.proxy.realIp == true) {
// 		gjs.request.headers[gjs.serverConfig.proxy.realIpHeader] =
// 			gjs.request.connection.remoteAddress;
// 	}
// 
// 	function backgroundChecker(nodePtr, siteConfig, proxyname) {
// 	
// 		/* site reload cancel the test */
// 		if(nodePtr._version != siteConfig.version)
// 			return;
// 		
// 		var hdr = {
// 			host: siteConfig.serverName[0]
// 		};
// 		
// 		var options = {
// 			host: nodePtr.host,
// 			port: nodePtr.port,
// 			path: '/',
// 			method: 'GET',
// 			headers: hdr,
// 			rejectUnauthorized: false,
// 			servername: hdr.host,
// 			agent: false
// 		};
// 		
// 		/* select flow control */
// 		var flowSelect = http;
// 		if(nodePtr.https == true)
// 			flowSelect = https;
// 		
// 		var req = flowSelect.request(options, function(res) {
// 			gjs.root.lib.gjsCore.logger.siteInfo(
// 				siteConfig.serverName[0], 
// 				"Proxy UP status for node "+nodePtr.host
// 			);
// 			
// 			clearTimeout(nodePtr.bgTimeoutId);
// 			delete nodePtr.bgTimeoutId;
// 			
// 			nodePtr.isFaulty = false;
// 
// 			/* send IPC message to tell that the host is up */
// 			gjs.root.lib.gjsCore.ipc.send('LFW', 'proxyPassTimeout', {
// 				proxyStreamName: siteConfig.proxyStreamName,
// 				proxyname: proxyname,
// 				host: nodePtr.host,
// 				port: nodePtr.port,
// 				action: 'working'
// 			});
// 
// 			res.on('data', function(data) {});
// 		});
// 		req.on('error', function (error) {});
// 		
// 		function socketErrorDetection(socket) {
// 
// 			gjs.root.lib.gjsCore.logger.siteInfo(
// 				siteConfig.serverName[0], 
// 				"Proxy pass "+
// 				gjs.response.connector+" still DOWN"
// 			);
// 			
// 			nodePtr.bgTimeoutId = setTimeout(
// 				backgroundChecker, 
// 				2000,
// 				nodePtr,
// 				siteConfig,
// 				proxyname
// 			);
// 				
// 			req.abort();
// 		}
// 		
// 		req.on('socket', function (socket) {
// 			nodePtr.timeout = 30000;
// 			socket.setTimeout(nodePtr.timeout, function() {
// 				socketErrorDetection(socket);
// 			});
// 		});
// 
// 		req.on('data', function() { /* no nothing */ });
// 		req.end();
// 	}
// 
// 	

// 	
// 	console.log(request.url);
// 	emitDestinationRequest(nodePtr);
// 	
// 	gjs.stop();
// 	return(true);
	
}

proxyPass.ctor = function(gjs) {
// 	gjs.lib.gjsCore.ipc.on('proxyPassTimeout', function(gjs, data) {
// 		var proxyStream = gjs.lib.bwsRg.siteConfig.getSiteByConf(data.msg.proxyStreamName);
// 		if(!proxyStream)
// 			return;
// 		
// 		var stream = proxyStream.proxyStream[data.msg.proxyname];
// 		if(!stream)
// 			return;
// 		
// 		var ipBlock = false;
// 		for(var a in stream.reverse) {
// 			var b = stream.reverse[a];
// 			if(b.host == data.msg.host && b.port == data.msg.port)
// 				ipBlock = b;
// 		}
// 		if(!ipBlock)
// 			return;
// 		
// 		if(data.msg.action == 'deferred')
// 			ipBlock.isFaulty = true;
// 		else 
// 			ipBlock.isFaulty = false;
// 	});
}

module.exports = proxyPass;


