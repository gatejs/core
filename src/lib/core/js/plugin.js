/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core plugin management [http://www.binarysec.com]
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

var fs = require('fs');

var plugin = function(gjs) { };

var localPlugins = {};

plugin.loader = function(gjs) {
	function loadModule(dir) {
		
		var filename = dir+'/index.js';
		try {
			var fss = fs.statSync(filename);

			/* get plugin name */
			var o = require(filename);
			
			if(!o.getName) {
				gjs.lib.core.logger.system('No name defined for plugin '+dir);
				return(false);
			}
			var name = o.getName();
			
			/* sanatize */
			if(gjs.lib[name]) {
				gjs.lib.core.logger.system('Plugin '+name+' already exists');
				return(false);
			}
			gjs.lib[name] = o;
			localPlugins[name] = o;
			
			if(o.preLoader)
				o.preLoader(gjs);
		} catch(e) {
			gjs.lib.core.logger.system('Can not load module in '+dir+': '+e);
		}
	}
	
	if(gjs.serverConfig.plugins) {
		for(var a in gjs.serverConfig.plugins)
			loadModule(gjs.serverConfig.plugins[a]);
		
		/* init plugin at the end of cluster init */
		gjs.events.on('clusterPreInit', function() {
			for(var a in localPlugins)
				localPlugins[a].loader(gjs);
		});
	}
}

module.exports = plugin;


