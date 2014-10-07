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
 * 
 * Origin: Michael VERGOZ
 */

var util = require("util");
var http = require("http");
var https = require("https");
var events = require('events');
var dns = require('dns');
var net = require('net');

var proxyPass = function() { /* loader below */ } 

proxyPass.request = function(pipe, opts) {
	/* select DNS from host */
	var tmp = pipe.request.headers.host.indexOf(':');
	var reqHost;
	var reqPort;
	var reqLocalAddress = undefined;
	
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
	
	/* check for local address */
	if(opts.localAddress) 
		reqLocalAddress = opts.localAddress;
	
	function emitDestinationRequest(ip, port, from, localAddress) {
		
		pipe.response.on('error', function(err) {
			pipe.response.emit("fwProxyPassClientClose"); 
		});
		
		pipe.response.on('finish', function() {
			pipe.response.emit("fwProxyPassClientFinish"); 
		});
		
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
			agent: pipe.server.agent
		};
	
		/* from is used by tproxy when source is translated */
		if(from != undefined)
			options.localAddress = from;
		/* administrator can specify source address */
		else if(reqLocalAddress)
			options.localAddress = reqLocalAddress;

		pipe.response.connector = ip+":"+port;

		for(var n in pipe.request.headers)
			options.headers[pipe.request.orgHeaders[n]] = pipe.request.headers[n];
		
// 		delete pipe.request.headers.connection;
		var req = http.request(options);
		
// 		req.setSocketKeepAlive(false);
		
// 		pipe.root.lib.core.ipc.send('LFW', 'bsStatus', {
// 			host: pipe.request.headers.host,
// 			miss: true
// 		});
		
		/* emit the preProxyPass */
		pipe.response.emit("fwProxyPassPassConnection", options, req);
		
		/* detect whether source server is disconnected abnormaly */
		var reqAbort = function() {
			req.abort();
		}
		pipe.request.on('close', reqAbort);
		
		req.on('response', function(res) {
			pipe.request.removeListener('close', reqAbort);
			
				
// 			console.log(res.headers);
			/* abort connexion because someone is using it for a post response*/
			if(pipe.response.headerSent == true) {
				req.abort();
				return;
			}
			
			pipe.response.emit("fwProxyPassPassRequest", pipe, req, res);
			pipe.response.emit("response", res, "fwpass");
			
			var counter = 0;
			res.on('data', function(data) { counter += data.length; });
// 			pipe.response.on('finish', function() {
// 				pipe.root.lib.core.ipc.send('LFW', 'bsStatus', {
// 					host: pipe.request.headers.host,
// 					missBand: counter
// 				});
// 			});
		
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
// 			console.log(res.headers);
			pipe.root.lib.http.forward.logpipe(pipe, res);
// 			res.pipe(pipe.response);
			
		});
	
		req.on('error', function (error) {
			pipe.response.emit("fwProxyPassSourceRequestError"); 

// 			pipe.root.lib.core.logger.siteInfo(
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
			if(!socket.connected) 
				socket.connected = false;
			
			if(socket.connected == true)
				return;
			
			socket.timeoutId = setTimeout(
				socketErrorDetection, 
				pipe.server.config.timeout*1000, 
				socket
			);
			socket.on('connect', function() {
				socket.connected = true;
				clearTimeout(socket.timeoutId); 
			});
		});

		pipe.response.emit("fwProxyPassPassPrepare", req);
		pipe.request.pipe(req);
	}
	
	/* 
	 * tproxy source destination routing
	 */
	function modeTproxy(spoof, woport) {
		var realDst;
		try {
			realDst = pipe.root.lib.tproxy.node.getTproxyRealDest(pipe.request.client._handle.fd);
		}
		catch(e) {
			pipe.root.lib.http.error.renderArray({
				pipe: pipe, 
				code: 500, 
				tpl: "5xx", 
				log: true,
				title:  "Internal server error",
				explain: "Could not get destination address using tproxy"
			});

			pipe.stop();
			return(true);
		}

		pipe.pause();
		spoof = spoof == true ? pipe.request.client._peername.address : undefined;
		woport = woport == true ? reqPort : realDst.port;
		
		emitDestinationRequest(realDst.address, woport, spoof);
	}
	
	/* 
	 * HOST routing
	 */
	function modeHost(spoof) {
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
		
		if(net.isIP(reqHost)) {
			pipe.pause();
			spoof = spoof == true ? pipe.request.client._peername.address : undefined;
			emitDestinationRequest(reqHost, reqPort, spoof);
			return(true);
		}
		
		/* launch DNS query */
		pipe.pause();
		
		/* defaulting dnsRetry */
		if(!opts.dnsRetry)
			opts.dnsRetry = 3;
		
		var retry = 0;
		
		function runDNS() {
			dns.resolve4(reqHost, function (err, addresses) {
				if(err) {
					retry++;
				
					if(retry >= opts.dnsRetry) {
						/* ok error */
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
					
					runDNS();
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
				
				spoof = spoof == true ? pipe.request.client._peername.address : undefined;
				emitDestinationRequest(addresses[0], reqPort, spoof, reqLocalAddress);
			});
		}
		
		var ip = pipe.root.lib.core.hosts.resolve(reqHost);
		if(ip) {
			spoof = spoof == true ? pipe.request.client._peername.address : undefined;
			emitDestinationRequest(ip, reqPort, spoof, reqLocalAddress);
		}
		else
			runDNS();
	}

	
	/* switch options */
	switch(opts.mode) {
		case 'tproxy-src-host':
			modeHost(true);
			break;
		case 'tproxy-src-dst':
			modeTproxy(true);
			break;
		case 'tproxy-dst':
			modeTproxy(false);
			break;
		case 'tproxy-dst-woport':
			modeTproxy(false, true);
			break;
		default:
			modeHost(false);
			break;
	}
	
	return(false);
	
}

proxyPass.ctor = function(bs) {

}

module.exports = proxyPass;


