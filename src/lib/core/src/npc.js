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

// var util = require("util");
var net = require("net");
var fs = require("fs");
var readline = require('readline');
var util = require("util");
var crypto = require("crypto");
var cluster = require("cluster");

var npc = function(bs) { /* loader below */ };

npc.loader = function(bs) {
	if(!cluster.isMaster)
		return;
	
	npc.userCast = {};
	
	npc.send = function(msg) {
		msg.ttl = 1;
		msg.rand = Math.random();
		msg.from = bs.serverConfig.hostname+':'+msg.from;
		
		for(var a in npc.userCast)
			npc.userCast[a].send(msg);
	}
	
	/* sanatize configuration */
	if(!bs.serverConfig.npc)
		return;
	
	if(!bs.serverConfig.hostname) {
		console.log("Please define hostname in server configuration to use NPC");
		return;
	}
	
// 	var zlibOptions = {
// 		flush: zlib.Z_SYNC_FLUSH,
// 		strategy: zlib.Z_FIXED
// 	};
	
	function receiveMessage(client, data) {
		try {
			var jdata = JSON.parse(data);
		} catch(e) {
			bs.lib.bsCore.logger.system('NPC server JSON parse error from '+client.remoteAddress);
			client.end();
			return(false);
		}
		
		/* send message to local IPC */
		bs.master.ipc.broadcast(JSON.stringify(jdata), false);
		
		/* broadcast remote message */
		for(var a in npc.userCast) {
			if(a != client.fd)
				npc.userCast[a].send(jdata);
		}
		
	}
	
	/*
	 * Server context
	 */
	function bindServer(conf) {
		var service = net.Server().listen(conf.port, conf.address);
		
		service.on('listening', function() {
			bs.lib.bsCore.logger.system("NPC service running on "+conf.address+':'+conf.port);
		});
		
		service.on('connection', function(client) {
			bs.lib.bsCore.logger.system("Receive NPC connection from "+client.remoteAddress);

			function timeoutChecker() {
				client.destroy();
			}
			
			client.npcCipher = crypto.createCipher(
				bs.serverConfig.npc.algo, bs.serverConfig.npc.sharedKey
			);
			client.npcDecipher = crypto.createDecipher(
				bs.serverConfig.npc.algo, bs.serverConfig.npc.sharedKey
			);
			client.npcCipher.setAutoPadding(false);
			client.npcDecipher.setAutoPadding(false);

// 			client.npcZipInput = zlib.createInflate(zlibOptions);
// 			client.npcZipOutput = zlib.createDeflate(zlibOptions);
			client.npcAuth = false;
			client.setTimeout(2000, timeoutChecker);
			
			npc.userCast[client._handle.fd] = client;
			client.fd = client._handle.fd;
			
			/* to prevent cipher error */
			client.on('data',  function(data) {
				client.npcDecipher.write(data);
			});
			
			client.send = function(data) {
				client.npcCipher.write(JSON.stringify(data)+"\n");
			}
			
			/* second stage plug readline on zip output */
			client.readline = readline.createInterface({
				terminal: false,
				input: client.npcDecipher
			});
			
			client.npcDecipher.on('error', function() {
				client.end();
			});
			
			client.readline.on('line', function(data) {

				/* Authentification */
				if(client.npcAuth == false) {
					try {
						var jdata = JSON.parse(data);
					} catch(e) {
						bs.lib.bsCore.logger.system('NPC server JSON parse error from '+client.remoteAddress);
						client.end();
						return(false);
					}
				
					if(!jdata.key || !jdata.hostname) {
						bs.lib.bsCore.logger.system('NPC server parse error from '+client.remoteAddress);
						// log
						client.end();
						return;
					}
					
					if(jdata.key != bs.serverConfig.npc.sharedKey) {
						bs.lib.bsCore.logger.system('NPC server wrong key from '+client.remoteAddress);
						client.end();
						return;
					}
					
					if(jdata.hostname == bs.serverConfig.hostname) {
						bs.lib.bsCore.logger.system('NPC server authentified on the same host');
						client.end();
						return;
					}
					
					client.npcAuth = true;
					// log auth
					
					bs.lib.bsCore.logger.system('NPC server authentified from '+client.remoteAddress);
					
					client.setTimeout(0);
					
					return;
				}
				
				/* forwarding */
				receiveMessage(client, data);
		
			});
			
			client.on('end', function() {
				delete npc.userCast[client.fd];
			});
			
// 			client.pipe(client.npcDecipher); /* reading */
			client.npcCipher.pipe(client); /* writing */
			
		});
	}
	
	/*
	 * Client context
	 */
	function tryClient(conf) {
		var client = net.connect(conf.port, conf.address, function() {
			clearInterval(b.interval);
			
			/* push user cast */
			npc.userCast[client._handle.fd] = client;
			client.fd = client._handle.fd;
			client.remoteAddress = conf.address;
			
			/* create cypher */
			client.npcCipher = crypto.createCipher(
				bs.serverConfig.npc.algo, bs.serverConfig.npc.sharedKey
			);
			client.npcDecipher = crypto.createDecipher(
				bs.serverConfig.npc.algo, bs.serverConfig.npc.sharedKey
			);
			client.npcCipher.setAutoPadding(false);
			client.npcDecipher.setAutoPadding(false);
			
// 			client.npcZipInput = zlib.createInflate(zlibOptions);
// 			client.npcZipOutput = zlib.createDeflate(zlibOptions);
			client.npcAuth = false;
			
			client.pipe(client.npcDecipher); /* reading */
			client.npcCipher.pipe(client); /* writing */
			
			client.send = function(data) {
				client.npcCipher.write(JSON.stringify(data)+"\r\n");
			}
			
			client.readline = readline.createInterface({
				terminal: false,
				input: client.npcDecipher
			});
			
			client.readline.on('line', function(data) {

				/* forwarding */
				receiveMessage(client, data);
				
			});
			
			bs.lib.bsCore.logger.system('NPC client connected to '+conf.address+':'+conf.port);
			client.send({
				hostname: bs.serverConfig.hostname,
				key: bs.serverConfig.npc.sharedKey
				
			});
		});
		
		client.on('error', function(err) {
			bs.lib.bsCore.logger.system(
				'NPC error connecting to '+conf.address+
				':'+conf.port+' #'+err.code
			);
			clearInterval(b.interval);
			b.interval = setInterval(tryClient, 10000, conf);
			client.end();
		});
		
		
		client.on('end', function() {
			delete npc.userCast[client.fd];
			
			clearInterval(b.interval);
			b.interval = setInterval(tryClient, 10000, conf);
			client.end();
			
			bs.lib.bsCore.logger.system('NPC client disconnected from '+conf.address+':'+conf.port);
		});
	}

	/*
	 * Bind npc servers
	 */
	for(var a in bs.serverConfig.npc.servers)
		bindServer(bs.serverConfig.npc.servers[a]);
	

	/*
	 * Bind npc clients
	 */
	for(var a in bs.serverConfig.npc.clients) {
		var b = bs.serverConfig.npc.clients[a];
		b.interval = setInterval(tryClient, 10000, b);
	}

	
}


module.exports = npc;


