/*
 * Copyright (c) 2016 BinarySEC SAS
 * HTTP proxy connector [http://www.binarysec.com]
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.	If not, see <http://www.gnu.org/licenses/>.
 */
const http = require("http");
const https = require("https");

var proxy = function(pipe, stream) {

	/* mini event emitter */
	this.pipe = pipe;
	this.streamName = stream;
	this.http = pipe.root.lib.http;

};

proxy.prototype.selectIn = function(key) {
	var ret,
		node,
		nodePtr, rkey;

	if(!this.stream)
		return(false);

	var pipe = this.pipe;

	var rkey = key+'Ctx';
	var reverse = this.stream[key];
	var base = this.stream[rkey] ? this.stream[rkey] : this.stream[rkey] = {};

	/* no current stream */
	if(!base.currentStream)
		base.currentStream = 0;

	/* no more proxy up */
	if(!reverse)
		return(false);

	/* check current stream if we can use it */
	nodePtr = reverse[base.currentStream];
	if(!nodePtr) {
		return(false);
	}

	/* weight */
	if(!nodePtr.currentWeight)
		nodePtr.currentWeight = 0;
	if(nodePtr.weight > nodePtr.currentWeight && nodePtr.isFaulty != true) {
		nodePtr.currentWeight++;
		return(nodePtr);
	}

	if(this.stream.type == "rr") {
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
	else if(this.stream.type == "iphash") {
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

proxy.prototype.select = function() {
	var nodePtr = this.selectIn('primary');
	if(nodePtr == false) {
		var nodePtr = this.selectIn('secondary');
		if(nodePtr == false)
			return(false);
	}
	return(nodePtr);
}

proxy.prototype.connect = function() {
	var self = this;
	var nodePtr = this.node;
	var pipe = this.pipe;

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
	if(nodePtr.forceHttps == true) {
		flowSelect = https;
		options.port = nodePtr.httpsPort ? nodePtr.httpsPort : 443;
	}
	else if(self.stream.hybrid == true) {
		if(pipe.server.config.ssl == true) {
			flowSelect = https;
			options.port = nodePtr.httpsPort ? nodePtr.httpsPort : 443;
		}
		else
			options.port = nodePtr.httpPort ? nodePtr.httpPort : 80;
	}
	else
		options.port = nodePtr.httpPort ? nodePtr.httpPort : 80;

	var req;
	try {
		req = flowSelect.request(options, onResponse);
	}
	catch(e) {
		pipe.request.destroy();
		console.log('Catched error on flowSelect.request', e);
		return;
	}
	
	var clientPrematureClose = false;
	
	pipe.request.on('close', function(err) {
		clientPrematureClose = true;
	});

	function onResponse(res) {
		if(clientPrematureClose) {
			res.destroy();
			return;
		}
		
		req.ask = false;

		// if(req.socket.timeoutId) {
		// 	clearTimeout(req.socket.timeoutId);
		// 	req.socket.timeoutId = null;
		// }

		if(pipe.upgrade)
			return;

		/* remove request timeout */
		req.socket.connected = true;
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

		/* fix headers */
		var nHeaders = {};
		for(var n in res.headers)
			nHeaders[res.orgHeaders[n]] = res.headers[n];

		/* check for client close */
		pipe.request.on('close', function() {
			// close emit request
			res.destroy();
		});

		/* check if there is bad chars in content header */
		try {
			pipe.response.writeHead(res.statusCode, nHeaders);
			pipe.response.headerSent = true;
		} catch(e) {
			//console.log('proxy writeHead: '+e.message)

			// close emit request
			res.destroy();

			pipe.root.lib.http.error.renderArray({
				pipe: pipe,
				code: 500,
				tpl: "5xx",
				log: true,
				title:	"Internal Server Error",
				explain: e.message
			});
			return;
		}

		/* lookup sub pipe */
		var subPipe = res;
		if(pipe.subPipe)
			subPipe = pipe.subPipe;

		self.http.reverse.logpipe(pipe, subPipe);
	}

	function computeRetry() {
		req.abort();

		/* retry computing */
		if(!nodePtr._retry)
			nodePtr._retry = 0;
		nodePtr._retry++;

		/* check if the server is down */
		if(nodePtr._retry >= nodePtr.retry) {
			self.http.reverse.error(pipe, "Proxy stream "+
				nodePtr.host+":"+nodePtr.port+" is DOWN");

			pipe.root.lib.core.ipc.send('LFW', 'proxyPassFaulty', {
				site: pipe.request.headers.host,
				node: nodePtr,
				port: options.port,
				https: flowSelect == https ? true : false
			});

			nodePtr.isFaulty = true;
		}

		if(nodePtr.isFaulty == true) {
			self.node = self.select();
			if(self.node == false) {
				self.http.error.renderArray({
					pipe: pipe,
					code: 504,
					tpl: "5xx",
					log: true,
					title:	"Bad gateway",
					explain: "Unable to establish connection to the backend server"
				});

				return(false);
			}
			else {
				self.connect();
				return;
			}
		}
		else {
			self.connect();
			return;
		}
	}

	if(pipe.upgrade) {
		req.on('upgrade', function(res, socket, upgradeHead) {
			/* remove request timeout */
			req.socket.connected = true;
			// clearTimeout(req.socket.timeoutId);

			pipe.response.emit("rvProxyPassPassRequest", pipe, req, res);
			pipe.response.emit("response", res, "rvpass");

			res.gjsSetHeader('Server', 'gatejs');

			/* fix headers */
			var nHeaders = {};
			for(var n in res.headers)
				nHeaders[res.orgHeaders[n]] = res.headers[n];

			/* build header packet */
			var h = 'HTTP/'+pipe.request.httpVersion+" "+res.statusCode+" "+res.statusMessage+
				'\r\n';
			for(var a in nHeaders)
				h += a+": "+nHeaders[a]+"\r\n";
			h += "\r\n";

			pipe.root.lib.http.reverse.log(pipe, 101);

			pipe.stop();

			socket.on('close', function() {
				//console.log("Remote disconnect");
				pipe.response.destroy();
			});

			pipe.response.on('close', function() {
				//console.log("Client disconnect");
				socket.destroy();
			});

			pipe.response.pipe(socket);
			socket.pipe(pipe.response);
			pipe.response.write(h);
		});
	}

	req.on('error', function (error) {
		pipe.response.emit("rvProxyPassSourceRequestError");

		// if(req.socket.timeoutId) {
		// 	clearTimeout(req.socket.timeoutId);
		// 	req.socket.timeoutId = null;
		// }

		if(pipe.response.headerSent == true) {
			var connector = options.host+":"+options.port;

			// log error source closing connectio
			self.http.error(pipe, "Proxy read error on "+
				connector+" for "+
				pipe.request.remoteAddress+
				":"+pipe.request.socket.remotePort);

			pipe.response.destroy();
			pipe.stop();
			req.ask = false;
			return;
		}

		//if(error.code != 'ECONNRESET') {
			self.http.error.renderArray({
				pipe: pipe,
				code: 504,
				tpl: "5xx",
				log: true,
				title:	"Bad gateway",
				explain: "Connection Error with code #"+error.code
			});

			if(!nodePtr._retry)
				nodePtr._retry = 0;
			nodePtr._retry++;
		//}
	});

	function socketErrorDetection(socket) {
		var connector = nodePtr.host+":"+options.port;
		self.http.reverse.error(pipe, "Proxy pass timeout on "+
			connector+" from "+
			pipe.request.remoteAddress+
			":"+pipe.request.socket.remotePort);
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

		socket.on('error', function(e) {
			self.http.error(pipe, 'Server socket error (from '+pipe.request.remoteAddress+') : '+e);
		});

		// if(socket.timeoutId)
		// 	clearTimeout(socket.timeoutId);
		// socket.timeoutId = setTimeout(
		// 	socketErrorDetection,
		// 	nodePtr.timeout*1000,
		// 	socket
		// );
	});

	pipe.response.emit("rvProxyPassPassPrepare", req);
	pipe.pause();
	req.ask = true;

	/* integrate async post manager here */
	// pipe.request.on('data', function(buffer) {
	// 	/* Also check slowloris or equivalent here */
	// 	if(req.socket.timeoutId)
	// 		clearTimeout(req.socket.timeoutId);
	// 	req.socket.timeoutId = setTimeout(
	// 		socketErrorDetection,
	// 		nodePtr.timeout*1000,
	// 		req.socket
	// 	);
	// });
	pipe.request.pipe(req);
}

proxy.prototype.forward = function() {

	this.pipe.pause();

	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	 *
	 *
	 * lookup proxy stream
	 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	if(!this.pipe.site.proxyStream || !this.pipe.site.proxyStream[this.streamName]) {
		this.http.error.renderArray({
			pipe: this.pipe,
			code: 500,
			tpl: "5xx",
			log: false,
			title:	"Internal server error",
			explain: "No Proxy Stream defined for this website"
		});
		return(true);
	}
	this.stream = this.pipe.site.proxyStream[this.streamName];

	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	 *
	 *
	 * Select a destination
	 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	this.node = this.select();
	if(this.node == false) {
		this.http.error.renderArray({
			pipe: this.pipe,
			code: 504,
			tpl: "5xx",
			log: true,
			title:	"Bad gateway",
			explain: "Unable to establish connection to the backend server"
		});

		return(false);
	}

	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	 *
	 *
	 * Connection
	 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	this.connect();

	return(false);

}

module.exports = proxy;
