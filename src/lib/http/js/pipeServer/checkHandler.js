/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * checkHandler opcode [http://www.binarysec.com]
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
var cluster = require("cluster");
var fs = require('fs');
var net = require('net');

var checkHandler = function(gjs) { }

var gjs;
var handlers = {};

function loadHandler(scanDir, name) {
	
	/* get configuration pipeline */
	if(!handlers[name])
		handlers[name] = {};
	else
		return(handlers[name]);
	
	var ptr = handlers[name];
	var fileName = scanDir+"/../serverHandler/"+name+".js";
	
	try {
		var st = fs.statSync(fileName);
		
		ptr.fileStat = st;
		ptr.hdlName = name;
		ptr.object = require(fileName);
		if(ptr.object.loader)
			ptr.object.loader(gjs);
		
		gjs.lib.core.ipc.send('LFW', 'checkHandlerLoad', {name: name});
		
	} catch(e) {
		gjs.lib.core.logger.error("Can not read directory "+e.path+" with error code #"+e);
		return(false);
	}
	
	return(handlers[name]);
}

	

checkHandler.request = function(pipe, options) {
	var mime = pipe.root.lib.http.littleFs.getMime(pipe.file);
	if(!mime)
		return(false);
		
	if(!pipe.location.handlers)
		return(false);
	if(!(mime in pipe.location.handlers))
		return(false);
	
	var hdlName = pipe.location.handlers[mime];

	/* load handler */
	var hdl = loadHandler(__dirname, hdlName);
	if(!hdl) {
		pipe.stop();
		pipe.root.lib.http.error.renderArray({
			pipe: pipe, 
			code: 500, 
			tpl: "5xx", 
			log: true,
			title:  "Internal server error",
			explain: "Error when starting handler"
		});
	}
	
	/* check request virtual */
	if(!hdl.object.request) {
		pipe.stop();
		pipe.root.lib.http.error.renderArray({
			pipe: pipe, 
			code: 500, 
			tpl: "5xx", 
			log: true,
			title:  "Internal server error",
			explain: "Enable to execute request event"
		});
	}

	/* check request handler returns */
	if(!hdl.object.request(pipe)) {
		pipe.stop();
		pipe.root.lib.http.error.renderArray({
			pipe: pipe, 
			code: 500, 
			tpl: "5xx", 
			log: true,
			title:  "Internal server error",
			explain: "Handler returns FALSE"
		});
	}
	
}

checkHandler.ctor = function(_gjs) {
	
	gjs = _gjs;
	if (cluster.isMaster) {
		
// 		console.log("Loading server handlers");
		
// 		/* please load handler into master process */
// 		gjs.lib.core.ipc.on('checkHandlerLoad', function(p, jdata) {
// 			loadHandler(__dirname, jdata.msg.name);
// 		});
// 		
// 		
// 		var supercgiName = gjs.serverConfig.runDir+"/supercgi"
// 		console.log(supercgiName);
// 	
// 		try {
// 			fs.statSync(supercgiName);
// 			fs.unlinkSync(supercgiName);
// 		} catch(e) { }
// 		
// 		var server = net.createServer(function(c) { //'connection' listener
// 			console.log('client connected');
// 			c.on('end', function() {
// 				console.log('client disconnected');
// 			});
// 			c.write('hello\r\n');
// 			c.pipe(c);
// 		});
// 		server.listen(supercgiName, function() { //'listening' listener
// 			console.log('server bound');
// 		});
	
	
	
	}
	else {
// 		gjs.superCGI = function(command, userID, groupID) {
// 			console.log(arguments);
// 		}
	}
	
	
	
}

module.exports = checkHandler;


