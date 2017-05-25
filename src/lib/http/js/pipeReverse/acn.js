/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * ACN opcode [http://www.binarysec.com]
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
var url = require("url");
var fs = require("fs");
var cluster = require("cluster");

var acn = function(pipe) { }

acn.request = function(pipe, opts) {
	
// 	if(pipe.pipeStoreHit != true && pipe.root.serverConfig.cache.exclusive == true)
// 		return(false);
	
	if(pipe.request.forceCache != true) {
		if(pipe.request.method != 'GET')
			return(false);

		if(pipe.request.headers.range || pipe.request.headers['content-range'])
			return(false);
	}
	
	pipe.pause();
	
	pipe.root.lib.acn.askDigest(pipe, function(err, data) {
		if(!err) {
			
			/* emit connection to the TCP ACN server */
			var options = {
				hostname: data.rinfo.address,
				port: data.rinfo.port,
				path: '/?fileHash='+data.data.hash,
				method: 'GET',
				headers: {},
				rejectUnauthorized: false,
				agent: acn.agent
			};

			var req = http.request(options);
			
			pipe.response.on('close', (function() {
				req.abort();
// 				console.log('close');
			}));
		
			req.on('response', function(res) {
				if(res.statusCode < 300 && res.statusCode >= 200) {
					/* good condition for streaming */
					pipe.response.writeHead(res.statusCode, res.headers);
					res.pipe(pipe.response);
					return(true);
				}
				
				pipe.resume();
				pipe.execute();
				return(true);
				
			});
			
			req.on('error', function (error) {
				console.log(error);
				req.abort();
				pipe.resume();
				pipe.execute();
			});
			
			req.on('socket', function (socket) {
				function socketErrorDetection(socket) {
					req.abort();
					pipe.resume();
					pipe.execute();
				}
		
				socket.timeoutId = setTimeout(
					socketErrorDetection, 
					15000, 
					socket
				);
				
				socket.on('connect', function() { 
					clearTimeout(socket.timeoutId); 
				});

				
			});
			
			req.end();
		}
		else {
			pipe.resume();
			pipe.execute();
		}
		
		
		

	});
	
	return(true);
}

acn.ctor = function(gjs) {
	acn.agent = new http.Agent();
	
}

module.exports = acn; 
