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

var core = function() { /* loader below */ };

core.utils = require(__dirname+'/build/Release/core.node');
core.ipc = require(__dirname+'/js/ipc.js');
core.logger = require(__dirname+'/js/logger.js');
core.pipeline = require(__dirname+'/js/pipeline.js');

core.loader = function(gjs) {
	if(!gjs.serverConfig.runDir) {
		console.log('* No runDir defined, exiting');
		process.exit(0);
	}
	
	core.ipc.loader(gjs);
	core.logger.loader(gjs);
	core.pipeline.loader(gjs);
}

core.fixCamelLike = function(str) { 
	return str.replace(/(^|-)([a-zA-Z])/g,
		function (x, dash, chr) { 
			return dash + chr.toUpperCase(); 
	}); 
}

core.lookupSSLFile = function(options) {
	/* ca and crl as possible array */
	var root = gjs.serverConfig.libDir+'/ssl';
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
	
	
core.dateToStr = core.utils.dateToStr;
core.nreg = core.utils.nreg;

module.exports = core;
