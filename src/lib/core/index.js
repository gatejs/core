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

core.ipc = require(__dirname+'/src/ipc.js');
// core.logger = require(__dirname+'/src/logger.js');
// core.blacklist = require(__dirname+'/src/blacklist.js');
core.npc = require(__dirname+'/src/npc.js');

// console.log(binding);

core.loader = function(bs) {
	core.ipc.loader(bs);
// 	core.logger.loader(bs);
// 	core.blacklist.loader(bs);
	core.npc.loader(bs);
}

core.fixCamelLike = function(str) { 
	return str.replace(/(^|-)([a-zA-Z])/g,
		function (x, dash, chr) { 
			return dash + chr.toUpperCase(); 
	}); 
}

module.exports = core;
