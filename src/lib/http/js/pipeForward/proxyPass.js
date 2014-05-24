/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Forward proxy pass opcode [http://www.binarysec.com]
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
var dns = require('dns');

var proxyPass = function() { /* loader below */ } 

proxyPass.request = function(pipe, opts) {
	
	
	function emitDestinationRequest(ip, port, from) {
		
		pipe.response.on('error', function(err) {
			pipe.response.emit("fwProxyPassClientClose"); 
		});
		
		pipe.response.on('finish', function() {
			pipe.response.emit("fwProxyPassClientFinish"); 
		});
		
		console.log(pipe.request.urlParse);
		/*
		* Prepare and emit the request
		*/
		var options = {
			hostname: ip,
			port: port,
			path: pipe.request.urlParse.path,
			method: pipe.request.method,
			headers: {},
			rejectUnauthorized: false,
			//agent: new pipe.root.lib.bwsFg.httpTproxy.newAgent(),
		};
		
		if(from) {
			options.localAddress = from;
		}
		pipe.response.connector = ip+":"+port;

// 		for(var n in pipe.request.headers)
// 			options.headers[pipe.root.lib.bsCore.fixCamelLike(n)] = pipe.request.headers[n];

// 		delete pipe.request.headers.connection;
		var req = http.request(options);
		
		req.setSocketKeepAlive(false);
		
// 		pipe.root.lib.bsCore.ipc.send('LFW', 'bsStatus', {
// 			host: pipe.request.headers.host,
// 			miss: true
// 		});
		
		/* emit the preProxyPass */
		pipe.response.emit("fwProxyPassPassConnection", options, req);
		
		/* detect whether source server is disconnected abnormaly */
		pipe.response.on('close', (function() {
			req.abort();
		}));
		
		req.on('response', function(res) {
			
// 			console.log(res.headers);
			/* abort connexion because someone is using it for a post response*/
			if(pipe.response.headerSent == true) {
				req.abort();
				return;
			}
			
			pipe.response.emit("fwProxyPassPassRequest", pipe, req, res);
			
			var counter = 0;
			res.on('data', function(data) { counter += data.length; });
// 			pipe.response.on('finish', function() {
// 				pipe.root.lib.bsCore.ipc.send('LFW', 'bsStatus', {
// 					host: pipe.request.headers.host,
// 					missBand: counter
// 				});
// 			});
		
// 			delete res.headers.connection;
// 			delete res.headers['keep-alive'];
// 			if(pipe.server.isClosing == true)
// 				res.headers.connection = 'Close';
			
			/* fix headers */
// 			var nHeaders = {};
// 			for(var n in res.headers)
// 				nHeaders[pipe.root.lib.bsCore.fixCamelLike(n)] = res.headers[n];
	
			pipe.response.writeHead(res.statusCode, res.headers);
			pipe.response.headerSent = true;
// 			console.log(res.headers);
// 			pipe.root.lib.bwsFg.httpServer.logpipe(pipe, res);
			res.pipe(pipe.response);
			
		});
	
		req.on('error', function (error) {
			pipe.response.emit("fwProxyPassSourceRequestError"); 

// 			pipe.root.lib.bsCore.logger.siteInfo(
// 				pipe.request.selectedConfig.serverName[0], 
// 				"Proxy pass error on "+
// 				pipe.response.connector+" from "+
// 				pipe.request.connection.remoteAddress+
// 				":"+pipe.request.connection.remotePort+
// 				" with error code #"+error.code
// 			);
			pipe.root.lib.http.error.renderArray({
				pipe: pipe, 
				code: 504, 
				tpl: "5xx", 
				log: true,
				title:  "Bad gateway",
				explain: "TCP connection error to "+pipe.response.connector
			});
			req.abort();
			pipe.stop();
			return(true);
		});

		function socketErrorDetection(socket) {
			req.abort();
			
			/* can select another one ? */
			if(pipe.response.headerSent != true) {
				pipe.root.lib.http.error.renderArray({
					pipe: pipe, 
					code: 504, 
					tpl: "5xx", 
					log: true,
					title:  "Bad gateway",
					explain: "Unable to establish TCP connection to "+pipe.response.connector
				});
				pipe.stop();
				return(true);
			}
		}
		
		req.on('socket', function (socket) {
			socket.timeoutId = setTimeout(
				socketErrorDetection, 
				15000, 
				socket
			);
			
			socket.on('connect', function() { 
				clearTimeout(socket.timeoutId); 
			});

			
			if(!socket.bgWatcher) {
				socket.bgWatcher = setTimeout(
					function() { 
// 						console.log('bg timeout'); 
// 						socket.destroy();
					}, 
					10000
				);
			}
			
		});

		pipe.response.emit("fwProxyPassPassPrepare", req);
		pipe.request.pipe(req);
	}
	
	
	/* 
	 * tproxy source spoof + host DNS routing
	 */
	function modeTproxySrcHost() {
		
	}
	
	/* 
	 * tproxy source destination routing
	 */
	function modeTproxySrcDst() {
		
	}
	
	/* 
	 * tproxy destination routing
	 */
	function modeTproxyDst() {
		
	}
	
	/* 
	 * HOST routing
	 */
	function modeHost() {
		/* check host */
		if(!pipe.request.headers.host) {
			pipe.root.lib.http.error.renderArray({
				pipe: pipe, 
				code: 504, 
				tpl: "5xx", 
				log: true,
				title:  "Bad gateway",
				explain: "Can not resolv you Host header request"
			});
			pipe.stop();
			return(true);
		}
		
		/* select DNS from host */
		var tmp = pipe.request.headers.host.indexOf(':');
		var reqHost;
		var reqPort;
	
		if(tmp > 0) {
			reqHost = pipe.request.headers.host.substr(0, tmp);
			reqPort = pipe.request.headers.host.substr(tmp+1);
		}
		else {
			reqHost = pipe.request.headers.host;
			reqPort = 80;
		}
		
		if(reqPort <= 0 || reqPort >= 65535)
			reqHost = 80;
		
		pipe.pause();
		dns.resolve4(reqHost, function (err, addresses) {
			if(err) {
				pipe.root.lib.http.error.renderArray({
					pipe: pipe, 
					code: 504, 
					tpl: "5xx", 
					log: true,
					title:  "DNS error",
					explain: "Unable to resolv DNS entry for "+reqHost+' '+err
				});
				pipe.stop();
				return(true);
			}
		
			if(addresses[0] == '127.0.0.1') {
				pipe.root.lib.http.error.renderArray({
					pipe: pipe, 
					code: 504, 
					tpl: "5xx", 
					log: true,
					title:  "Bad gateway",
					explain: "Unable to connect to localhost"
				});
				pipe.stop();
				return(true);
			}
			
			emitDestinationRequest(addresses[0], reqPort);
		});

	}

	/* switch options */
	switch(opts.mode) {
		case 'tproxy-src-host':
			modeTproxySrcHost();
			break;
		case 'tproxy-src-dst':
			modeTproxySrcDst();
			break;
		case 'tproxy-dst':
			modeTproxyDst();
			break;
		default:
			modeHost();
			break;
	}
	
	return(false);
	
}

proxyPass.ctor = function(bs) {

}

module.exports = proxyPass;


