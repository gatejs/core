/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core engine [http://www.binarysec.com]
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

var httpPlug = require('http');
var fs = require('fs');
var constants = require('constants');

function fixHeaders(field, value) {
	if(!this.orgHeaders)
		this.orgHeaders = {};
	var c = field.toLowerCase();
	this.orgHeaders[c] = field;
}

function setHeader(name, value) {
	if(!this.orgHeaders)
		this.orgHeaders = {};
	if(!this.headers)
		this.headers = {};
	var k = name.toLowerCase();
	this.headers[k] = value;
	this.orgHeaders[k] = name;
}

function removeHeader(name) {
	var k = name.toLowerCase();
	delete this.headers[k];
	delete this.orgHeaders[k];
}

/* patch to accept sensitve headers by hooking node.js header addition */
httpPlug.IncomingMessage.prototype._addHeaderLineOld = httpPlug.IncomingMessage.prototype._addHeaderLine;
httpPlug.IncomingMessage.prototype._addHeaderLine = function(field, value) {
	fixHeaders.apply(this, arguments);
	return(this._addHeaderLineOld(field, value));
}
httpPlug.IncomingMessage.prototype.gjsSetHeader = function(name, value) {
	return(setHeader.apply(this, arguments));
}
httpPlug.IncomingMessage.prototype.gjsRemoveHeader = function(name) {
	return(removeHeader.apply(this, arguments));
}

/* do the same on response */
httpPlug.OutgoingMessage.prototype._storeHeaderOld = httpPlug.OutgoingMessage.prototype._storeHeader;
httpPlug.OutgoingMessage.prototype._storeHeader = function(firstline, headers) {
	for(var a in headers)
		fixHeaders.apply(this, [a, headers[a]]);
	return(this._storeHeaderOld(firstline, headers));
}
httpPlug.OutgoingMessage.prototype.gjsSetHeader = function(name, value) {
	return(setHeader.apply(this, arguments));
}
httpPlug.OutgoingMessage.prototype.gjsRemoveHeader = function(name) {
	return(removeHeader.apply(this, arguments));
}

var http = function() { /* loader below */ };

http.agent = require(__dirname+'/js/agent');
http.log = require(__dirname+'/js/log');
http.littleFs = require(__dirname+'/js/littleFs');
http.error = require(__dirname+'/js/error');
http.site = require(__dirname+'/js/site');
http.forward = require(__dirname+'/js/forward');
http.reverse = require(__dirname+'/js/reverse');
http.server = require(__dirname+'/js/server');

http.lookupSSLFile = function(options) {
	var root = http.gjs.serverConfig.confDir+'/ssl';
	var keyLookup = ['cert', 'ca', 'pfx', 'key'];
	for(var a in keyLookup) {
		var z = keyLookup[a];
		if(options[z]) {
			var file = root+'/'+options[z];
			try {
				var fss = fs.statSync(file);
				options[z] = fs.readFileSync(file);
				
			} catch(e) {
				console.log('Can not open '+file+' '+e);
				return(false);
			}
		}
	}
	return(true);
}

http.hardeningSSL = function(conf) {
	if(!conf.ciphers)
		conf.ciphers = '!SSLv2:ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:ECDH+3DES:DH+3DES:RSA+AESGCM:RSA+AES:RSA+3DES:!aNULL:!MD5:!DSS';
	if(!conf.honorCipherOrder)
		conf.honorCipherOrder = true;
	
	if(!conf.secureProtocol)
		conf.secureProtocol = 'SSLv23_method';
	
	if(!conf.secureOptions)
		conf.secureOptions = constants.SSL_OP_NO_SSLv3;
}

http.loader = function(gjs) {
	http.gjs = gjs;
	var stats = gjs.lib.core.stats;
	
	/* */
	gjs.lib.core.stats.http = function(pipe) {
		
		var d = [
			{
				name: 'httpRequests',
				action: stats.action.add,
				value: 1
			},
			{
				name: 'httpReading',
				action: stats.action.add,
				value: 1
			},
// 			{
// 				name: 'httpWaiting',
// 				action: stats.action.sub,
// 				value: 1
// 			},
		];
		
		if(pipe.reverse === true) {
			d.push({
				name: 'reverseHttpRequests',
				action: stats.action.add,
				value: 1
			});
		}
		else {
			d.push({
				name: 'forwardHttpRequests',
				action: stats.action.add,
				value: 1
			});
		}
		
		stats.diffuse(d);
		
		/* reading token */
		pipe.request.on('end', function() {
			stats.diffuse([
				{
					name: 'httpReading',
					action: stats.action.sub,
					value: 1
				},
// 				{
// 					name: 'httpWriting',
// 					action: stats.action.add,
// 					value: 1
// 				},
			]);
		});
// 		pipe.response.on('finish', function() {
// // 			if(pipe.response.closed)
// // 				return;
// // 			console.log('finish', pipe.response.closed);
// 			stats.diffuse([
// 				{
// 					name: 'httpWriting',
// 					action: stats.action.sub,
// 					value: 1
// 				},
// // 				{
// // 					name: 'httpWaiting',
// // 					action: stats.action.add,
// // 					value: 1
// // 				},
// 			]);
// 		});
// 		pipe.response.on('close', function() {
// // 			pipe.response.closed = true;
// // 			console.log('close');
// 			stats.diffuse([
// 				{
// 					name: 'httpWriting',
// 					action: stats.action.sub,
// 					value: 1
// 				},
// // 				{
// // 					name: 'httpWaiting',
// // 					action: stats.action.add,
// // 					value: 1
// // 				},
// 			]);
// 		});
	}
	
	/* */
	try {
		http.agent.loader(gjs);
		http.log.loader(gjs);
		http.littleFs.loader(gjs);
		http.error.loader(gjs);
// 		http.site.loader(gjs);
		http.forward.loader(gjs);
		http.reverse.loader(gjs);
		http.server.loader(gjs);
	} catch(e) {
		console.log("* HTTP exeption\n", e);
	}
}

module.exports = http;
