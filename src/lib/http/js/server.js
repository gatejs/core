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

server.loader = function(gjs) {
	
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
		'servering'
	);
	if(!server.opcodes)
		return(false);
		
	/* 
	 * Follow configuration
	 */
// 	for(var a in gjs.serverConfig.http) {
// 		var sc = gjs.serverConfig.http[a];
// 		if(sc instanceof Array) {
// 			for(var b in sc)
// 				processConfiguration(a, sc[b]);
// 		}
// 		else if(sc instanceof Object)
// 			processConfiguration(a, sc);
// 	}
// 	
// 	function gracefulReceiver() {
// 		for(var a in server.list) {
// 			var server = server.list[a];
// 			server.isClosing = true;
// 			server.close(function() { });
// 		}
// 		
// 		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
// 	}
// 	
// 	/* add graceful receiver */
// 	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);
		
	return(false);
	
}

module.exports = server;

