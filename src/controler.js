/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Controler [http://www.binarysec.com]
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


var fs = require("fs");
var net = require("net");
var readline = require("readline");
var cluster = require('cluster');

var gatejs = (function() {
	this.serverConfig;
	
	function parseArgv(argv) {
		var ret = { line: '', kv: {} };
		for(var a=2; a<argv.length; a++) {
			var kv = argv[a].split('=');
			if(kv.length > 1) {
				var l = argv[a].indexOf('='),
				k = argv[a].substr(0, l),
				v = argv[a].substr(l+1);
				ret.kv[k] = v;
			}
			else
				ret.line += kv[0]+' ';
			
		}
		return(ret);
	}
	
	
	var argv = parseArgv(process.argv);

	
	
	/* Load server configuration */
	var socketFile;
	if(argv.kv['--socket'])
		socketFile = argv.kv['--socket'];
	else
		socketFile = "/tmp/gatejs/ipc";

	
	/* create IPC junction */
	var socketFile = socketFile;
	var client = net.connect(socketFile);
	
	client.send = function(type, cmd, msg) {
		client.write(JSON.stringify({
			from: process.pid,
			type: type,
			cmd: cmd,
			msg: msg
		})+'\n');
	}
			
	client.parseSend = function(data) {
		var t = data.split(" ");
		var type, cmd, msg = {};
		
		/* check coverage */
		if(t[1].match(/^lfw$/i))
			type = "LFW";
		else if(t[1].match(/^ffw$/i))
			type = "FFW";
		else {
			console.log("Unknown coverage");
			return;
		}
		
		cmd = t[2];
		
		/* parse message */
		for(var a = 3; a<t.length; a++) {
			var b = t[a].split('=');
			if(b.length == 2)
				msg[b[0]] = b[1];
		}

		client.send(type, cmd, msg);
	}
	
	client.on('error', function(err) {
		console.log("Unable to connect to bwsRg");
	});
	
	
	/* CLI mode line ? */
	if(argv.line.length > 1) {
		client.on('connect', function() {
			/* send command */
			console.log('Connected... sending command');
			console.log(argv.line);
			client.parseSend(argv.line);

			/* exit */
			console.log('Command sent exiting');
			client.end();
			
		});
	}
	else {
	
		client.on('connect', function() {
			client.readline = readline.createInterface({
				terminal: false,
				input: client
			});
			

			
			client.input = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			
			client.netShow = false;
			client.input.write("Welcome to the gate.js shell\n");
			client.input.setPrompt("gatejs# ");
			client.input.prompt(true);
			client.input.on('line', function(data) {
				if(data.match(/^exit$/) || data.match(/^quit$/)) {
					client.readline.close();
					client.input.close();
					client.end();
					return;
				}
				else if(data.match(/^show$/)) {
					client.netShow = true;
					console.log("Show IPC events");
				}
				else if(data.match(/^hide/)) {
					client.netShow = false;
					console.log("Hide IPC events");
				}
				else if(data.match(/^send/))
					client.parseSend(data);
				
				
				client.input.prompt(true);
			});
			
			
			client.readline.on('line', function(data) {
	// 			var jdata = JSON.parse(data);
				if(client.netShow == true)
					console.log(data);
			});
		
		});
	

	}

});

new gatejs();

