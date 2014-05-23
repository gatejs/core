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

var cluster = require("cluster");
var logger = function(gjs) { /* loader below */ };

logger.spawnMaster = function(gjs) {
	var net = require("net");
	var fs = require("fs");
	var readline = require('readline');
	var util = require("util");
	
	var socketFile = gjs.serverConfig.runDir+'/logger';
	
	gjs.mkdirDeep(socketFile);

	/* remove socketFile */
	try {
		fs.unlinkSync(socketFile);
	} catch(e) { /* do nothing */ }

	
	var selectFile = function(site, type) {
		var filename;
		if(site)
			filename = gjs.serverConfig.logDir+'/'+site+'.'+type+'.log';
		else
			filename  = gjs.serverConfig.logDir+'/'+type+'.log';
		
		/* create */
		return(selectThisFile(filename));
	}
	
	var selectThisFile = function(filename) {
		var ptr;
		
		if(!logger.onlineFile)
			logger.onlineFile = {};
		
		if(logger.onlineFile[filename])
			return(logger.onlineFile[filename]);
		
		/* create dirs if necessary */
		gjs.mkdirDeep(filename);
		
		/* open the stream */
		ptr = logger.onlineFile[filename] = {
			file: filename,
			stream: fs.createWriteStream(filename, { flags: 'a' })
		};
		
		ptr.stream.on('error', function(err) { console.log(err); });
		
		return(ptr);
	}
	
	var processSystem = function(req) {
// 		var dateStr = gjs.lib.bwsAi.dateToStr();
// 		
// 		var inline = 
// 			"SYS - "+
// 			dateStr+' - '+
// 			req.msg
// 		;
// 		
// 		/* write log */
// 		var f = selectFile(null, 'system');
// 		f.stream.write(inline+'\n');
// 		console.log(inline);
	}
	
	logger.typeTab = {
		SYS: processSystem,
	};
	
	var processLine = function(line) {
		var req = JSON.parse(line);
		var fct = logger.typeTab[req.type];
		if(fct)
			fct(req);
		else
			console.log("Uncatchable log type "+line);
	}
	
	/*
	 * Bind log server
	 */
	var service = net.Server().listen(socketFile);
	service.on('connection', function(client) {
		
		client.readline = readline.createInterface({
			terminal: false,
			input: client
		});
		
		client.readline.on('line', function(data) {
			if(!client.worker)
				client.worker = JSON.parse(data);
			else
				processLine(data);

		});
	
// 		client.on('end', function() {
// // 			console.log('server disconnected');
// 		});
	});
	
	logger.system = function(data) {
		var msg = {
			type: 'SYS',
			msg: data
		};
		processSystem(msg);
	}
	
	function doReload(gjs) {

		for(var a in logger.onlineFile) {
			var f = logger.onlineFile[a];
			
			try {
				/* close */
				f.stream.close();
				
				/* open */
				gjs.mkdirDeep(f.file);
				f.stream = fs.createWriteStream(f.file, { flags: 'a' });
				f.stream.on('error', function(err) { console.log(err); });
			
			} catch(e) {
				console.log("Logger stream error "+e);
			}
		}
		
		logger.system("Log rotation done");
		
	}
	
	/* handle reload */
	gjs.lib.core.ipc.on('SIGUSR2', doReload);
	gjs.lib.core.ipc.on('core:logger:reload', doReload);
}

logger.spawnSlave = function(gjs) {
	var net = require("net");
	var readline = require('readline');

	var socketFile = gjs.serverConfig.runDir+'/logger';
	
	gjs.mkdirDeep(socketFile);

	var client = net.connect(socketFile);
	
	client.on('connect', function() {
		var info = {
			id: gjs.cluster.worker.id,
			pid: gjs.cluster.worker.process.pid,
		};
		client.write(JSON.stringify(info)+'\r\n');
	});
	
// 	type : access
// 		method
// 		outBytes
// 		cache
// 		site
// 		userAgent
// 		referer
// 		url
// 		ip
// 		code
	logger.siteAccess = function(msg) {
		msg.type = 'ACC';
		client.write(JSON.stringify(msg)+'\r\n');
	}
	
	logger.siteInfo = function(site, data) {
		var msg = {
			type: 'INF',
			site: site,
			msg: data
		};
		client.write(JSON.stringify(msg)+'\r\n');
	}
	
	logger.system = function(data) {
		var msg = {
			type: 'SYS',
			msg: data
		};
		client.write(JSON.stringify(msg)+'\r\n');
	}
	
	logger.zoneAlert = function(site, zone, type, data) {
		var msg = {
			type: 'ALE',
			site: site,
			zone: zone,
			alertType: type,
			msg: data
		};
		client.write(JSON.stringify(msg)+'\r\n');
	}
	
	
	/* in order to graceful restart we need to close IPC connection to exit */
	function gracefulReceiver() {
		client.destroy();
		gjs.lib.core.ipc.removeListener('system:graceful:process', gracefulReceiver);
	}
	
	/* add graceful receiver */
	gjs.lib.core.ipc.on('system:graceful:process', gracefulReceiver);


}

logger.loader = function(gjs) {
	if(cluster.isMaster)
		logger.spawnMaster(gjs);
// 	else
// 		logger.spawnSlave(gjs);
	
}


module.exports = logger;


