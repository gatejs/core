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
		
		ptr.write = function(line) {
			var hn = gjs.serverConfig.hostname ? gjs.serverConfig.hostname : '-';
			ptr.stream.write(Date.now()+" "+hn+" - "+line+'\n');
		}
		
		return(ptr);
	}
	 

	var processSystem = function(req) {
	
		/* write log */
		var f = logger.selectFile(null, 'system');
		if(f) 
			f.write(req.msg);
		else
			console.log('LOG ERROR', req.msg);
	}
	
	var processError = function(req) {		
		/* write log */
		var f = logger.selectFile(null, 'error');
		if(f) 
			f.write(req.msg);
		else
			console.log('LOG ERROR', req.msg);
	}
	
	logger.typeTab = {
		SYS: processSystem,
		ERR: processError,
	};
	
	var processLine = function(req) {
		var fct = logger.typeTab[req.type];
		if(fct)
			fct(req);
	}
	
	/*
	 * Receiving log messages
	 */
	if(gjs.serverConfig.nologs) {
		gjs.lib.core.ipc.on('log', function(sgjs, data) {
			processLine(data.msg);
		});
	}
	
	/* master common log */
	logger.commonLogger = function(cmd, data) {
		var msg = {
			type: cmd,
			date: Date.now(),
			msg: data
		};
		processLine(msg);
	}
	
	logger.system = function(data) {
		var msg = {
			type: 'SYS',
			date: Date.now(),
			msg: data
		};
		processSystem(msg);
	}
	
	logger.error = function(data) {
		var msg = {
			type: 'ERR',
			date: Date.now(),
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
			date: Date.now(),
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
