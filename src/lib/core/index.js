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
core.ipc = require(__dirname+'/src/ipc.js');
core.logger = require(__dirname+'/src/logger.js');
core.pipeline = require(__dirname+'/src/pipeline.js');

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

core.dateToStr = core.utils.dateToStr;

module.exports = core;
