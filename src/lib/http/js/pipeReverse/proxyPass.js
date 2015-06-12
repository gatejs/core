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
var cluster = require("cluster");

var proxyPass = function() {} 

proxyPass.request = function(pipe, proxyname) {
	var reverse = pipe.root.lib.http.reverse;
	
	/* lookup proxy stream */
	if(!pipe.site.proxyStream && !pipe.site.proxyStream[proxyname]) {
		pipe.root.lib.http.error.renderArray({
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
		
		/* no more proxy up */
		if(!reverse) {
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
			if(pipe.request.remoteAddress) {
				var ipNums = pipe.request.remoteAddress.split(/[^0-9]+/).reverse();
				for(var i in ipNums)
					id ^= ipNums[i];
			}
			base.currentStream = id % reverse.length;
			
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

		/* use local address to emit network tcp connection */
		if(nodePtr.localAddress)
			options.localAddress = nodePtr.localAddress;
		
		for(var n in pipe.request.headers)
			options.headers[pipe.request.orgHeaders[n]] = pipe.request.headers[n];
		
		/* emit the preProxyPass */
		pipe.response.emit("rvProxyPassPassConnection", options, req);
		
		/* select flow control */
		var flowSelect = http;
		if(nodePtr.https == true)
			flowSelect = https;
		else if(proxyStream.hybrid == true) {
			if(pipe.server.config.ssl == true) {
				flowSelect = https;
				options.port = nodePtr.portSSL ? nodePtr.portSSL : 443;
			}
			else
				options.port = nodePtr.port ? nodePtr.port : 80;
		}
		else
			options.port = nodePtr.port ? nodePtr.port : 80;

		
		var req = flowSelect.request(options, function(res) {
			/* remove request timeout */
			req.connection.connected = true;
			clearTimeout(req.connection.timeoutId); 
				
			nodePtr._retry = 0;
			
			/* abort connexion because someone is using it for a post response */
			if(pipe.response.headerSent == true) {
				req.abort();
				return;
			}

			pipe.response.emit("rvProxyPassPassRequest", pipe, req, res);
			pipe.response.emit("response", res, "rvpass");
			
			res.gjsSetHeader('Server', 'gatejs');
			
			if(pipe.server.isClosing == true) {
				res.gjsSetHeader('Connection', 'Close');
				delete res.headers['keep-alive'];
			}
			
			if(!pipe.server.noVia)
				res.gjsSetHeader('Via', 'gatejs MISS');
				
			/* fix headers */
			var nHeaders = {};
			for(var n in res.headers)
				nHeaders[res.orgHeaders[n]] = res.headers[n];
			
			/* check for client close */
			pipe.request.on('close', function() {
				res.destroy();
			});
			
			pipe.response.writeHead(res.statusCode, nHeaders);
			pipe.response.headerSent = true;
			
			/* lookup sub pipe */
			var subPipe = res;
			if(pipe.subPipe)
				subPipe = pipe.subPipe;
			
			pipe.root.lib.http.reverse.logpipe(pipe, subPipe);
		});
		
		function computeRetry() {
			/* retry computing */
			if(!nodePtr._retry)
				nodePtr._retry = 0;
			nodePtr._retry++;
			
			if(nodePtr._retry >= nodePtr.retry) {
				reverse.error(pipe, "Proxy stream "+
					nodePtr.host+":"+nodePtr.port+" is DOWN");
		
				pipe.root.lib.core.ipc.send('LFW', 'proxyPassFaulty', {
					site: pipe.request.headers.host,
					node: nodePtr
				});
				
				nodePtr.isFaulty = true;
			}
			else {
				emitDestinationRequest(nodePtr);
				return;
			}
			
			req.abort();
			/* check another server */
			var subNodePtr = selectDestination('primary');
			if(subNodePtr == false) {
				subNodePtr = selectDestination('secondary');
				if(subNodePtr == false) {
					
					pipe.root.lib.http.error.renderArray({
						pipe: pipe, 
						code: 504, 
						tpl: "5xx", 
						log: true,
						title:  "Bad gateway",
						explain: "Unable to establish connection to the backend server"
					});
					return;
				}
			}
			emitDestinationRequest(subNodePtr);
		}
		
		req.on('error', function (error) {
			pipe.response.emit("rvProxyPassSourceRequestError"); 

			if(pipe.response.headerSent == true) {
				var connector = options.host+":"+options.port;
				
				// log error source closing connectio
				reverse.error(pipe, "Proxy read error on "+
					connector+" for "+
					pipe.request.remoteAddress+
					":"+pipe.request.connection.remotePort);
			
				pipe.response.destroy();
				pipe.stop();
				return;
			}

// 			computeRetry();
		});

		function socketErrorDetection(socket) {
			
			var connector = options.host+":"+options.port;
			
			reverse.error(pipe, "Proxy pass timeout on "+
				connector+" from "+
				pipe.request.remoteAddress+
				":"+pipe.request.connection.remotePort);
			socket.destroy();
			computeRetry();
		}
		
		req.on('socket', function (socket) {
			if(!socket.connected) 
				socket.connected = false;
			
			if(socket.connected == true)
				return;
			
			if(!nodePtr.timeout)
				nodePtr.timeout = 3;
			
			if(!nodePtr.retry)
				nodePtr.retry = 3;
			
			socket.timeoutId = setTimeout(
				socketErrorDetection, 
				nodePtr.timeout*1000, 
				socket
			);
		});

		pipe.response.emit("rvProxyPassPassPrepare", req);
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
}

proxyPass.ctor = function(gjs) {
	
	/* receive mutual faulty */
	gjs.lib.core.ipc.on('proxyPassFaulty', function(gjs, data) {
		var d = data.msg.node;
		var site = gjs.lib.http.reverse.sites.search(data.msg.site);
		if(!site)
			return;
		site.proxyStream[d._name][d._key][d._index].isFaulty = true;
	});
	
	/* receive mutual solution */
	gjs.lib.core.ipc.on('proxyPassWork', function(gjs, data) {
		var d = data.msg.node;
		var site = gjs.lib.http.reverse.sites.search(data.msg.site);
		if(!site)
			return;
		var node = site.proxyStream[d._name][d._key][d._index];
		node.isFaulty = false;
		node._retry = 0;
	});

}

module.exports = proxyPass;


