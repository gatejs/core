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

	
	logger.selectFile = function(site, type) {
		if(!gjs.serverConfig.logDir)
			return(false);
		
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
		
		ptr.stream.on('error', function(err) { 
			gjs.lib.core.logger.system('Error openning log file '+err.path+' with code #'+err.code);
			
		});
		
		return(ptr);
	}
	 

	var processSystem = function(req) {
		var dateStr = gjs.lib.core.dateToStr();
	
		var inline = 
			"SYS - "+
			dateStr+' - '+
			req.msg
		;
		
		/* write log */
		var f = logger.selectFile(null, 'system');
		if(f) 
			f.stream.write(inline+'\n');
		else
			console.log('LOG ERROR', inline);
	}
	
	var processError = function(req) {
		var dateStr = gjs.lib.core.dateToStr();
	
		var inline = 
			"ERROR - "+
			dateStr+' - '+
			req.msg
		;
		
		/* write log */
		var f = logger.selectFile(null, 'error');
		if(f) 
			f.stream.write(inline+'\n');
		else
			console.log('LOG ERROR', inline);
	}
	
	logger.typeTab = {
		SYS: processSystem,
		ERR: processError,
	};
	
	var processLine = function(req) {
		var fct = logger.typeTab[req.type];
		if(fct)
			fct(req);
		else
			console.log("* Uncatchable log type "+fct);
	}
	
	/*
	 * Receiving log messages
	 */
	gjs.lib.core.ipc.on('log', function(sgjs, data) {
		processLine(data.msg);
	});
	
	logger.system = function(data) {
		var msg = {
			type: 'SYS',
			msg: data
		};
		processSystem(msg);
	}
	
	logger.error = function(data) {
		var msg = {
			type: 'ERR',
			msg: data
		};
		processSystem(msg);
	}
	
	
	/* function receving soft reload */
	function doReload() {

		for(var a in logger.onlineFile) {
			var f = logger.onlineFile[a];
			
			/* rename */
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
		
		logger.system("Log rotation");
		
	}
	
	/* handle reload */
	gjs.lib.core.ipc.on('SIGUSR2', doReload);
	gjs.lib.core.ipc.on('core:logger:reload', doReload);
	
}

logger.spawnSlave = function(gjs) {

	logger.commonLogger = function(cmd, data) {
		var msg = {
			type: cmd,
			msg: data
		};
		gjs.lib.core.ipc.send('RFW', 'log', msg);
	}
	
	logger.system = function(data) {
		logger.commonLogger('SYS', data);
	}
	
	logger.error = function(data) {
		logger.commonLogger('ERR', data);
	}
	

}

logger.loader = function(gjs) {
	if(cluster.isMaster)
		logger.spawnMaster(gjs);
	else
		logger.spawnSlave(gjs);
	
}


module.exports = logger;


