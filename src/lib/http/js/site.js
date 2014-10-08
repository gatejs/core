/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Site management [http://www.binarysec.com]
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
var cluster = require("cluster");
var crypto = require("crypto");
var http = require('http');


var site = function(gjs, channel, configuration) { 
	
	function loadGeneric(dir, dst) {
		try {
			var d = fs.readdirSync(dir), a;
			
			for(a in d) {
				if(d[a].search(/\.js$/) > 0) {
					var m = d[a].match(/(.*)\.js$/);
					var f = dir + '/' + m[1];
					
					try {
						var data = fs.readFileSync(f+'.js');
						var estr = '(function() { return('+data.toString()+'); })();';
						var obj = eval(estr);
						obj.confName = m[1];
						
						if(!obj.name)
							throw('No site configuration name');
						
						/* inject nreg server name rules */
						if(obj.serverName) {
							
							if(obj.serverName instanceof Array) {
								for(var b in obj.serverName) {
									var key = gjs.lib.core.utils.cstrrev(obj.serverName[b]);
									dst.rules.add(key);
									dst.sites[key] = obj;
								}
							}
							else if(obj.serverName instanceof String) {
								var key = gjs.lib.core.utils.cstrrev(obj.serverName);
								dst.rules.add(key);
								dst.sites[key] = obj;
							}
							else
								throw('Invalid argument for serverName in '+obj.confName);
						}
						else
							throw('No serverName defined in '+obj.confName);
						
						/* format interface */
						if(obj.interfaces) {
							obj.solvedInterfaces = {};
							if(obj.interfaces instanceof Array) {
								for(var b in obj.interfaces)
									obj.solvedInterfaces[obj.interfaces[b]] = true;
							}
							else if(obj.interfaces instanceof String)
								obj.solvedInterfaces[obj.interfaces] = true;
						}
						
						/* format proxy stream */
						if(obj.proxyStream) {
							for(var a in obj.proxyStream) {
								var nodes = obj.proxyStream[a];
								function formatProxy(key) {
									if(!nodes[key])
										return;
									var servers = nodes[key];
									for(var b in servers) {
										var node = servers[b];
										node._name = a;
										node._key = key;
										node._index = b;
									}
								}
								formatProxy('primary');
								formatProxy('secondary');
							}
						}
						
					}
					catch (err) {
						gjs.lib.core.logger.error("Error loading file "+f+'.js : '+err);
					}

				}
			}
		} catch(e) {
			gjs.lib.core.logger.error("Can not read directory "+e.path+" with error code #"+e.code);
			return(false);
		}
		return(true);
	}

	this.search = function(name) {
		if(!name)
			return(false);
		var pos = this.rules.match(gjs.lib.core.utils.cstrrev(name));
		if(pos)
			return(this.sites[pos]);
		return(false);
		
	}

	this.reload = function() {
		/* reload pipeline */
		for(var a in  this.sites)
			this.sites[a].pipeline = gjs.lib.core.pipeline.scanOpcodes(channel);
	}
	
	var ret;

	this.sites = {};
	
	/* create nreg context */
	this.rules = new gjs.lib.core.nreg();
	
	/* Load opcode context */
	this.opcodes = gjs.lib.core.pipeline.scanOpcodes(
		__dirname+'/'+channel,
		channel
	);
	if(!this.opcodes) {
		gjs.lib.core.logger.error('No opcodes found for '+channel);
		return(false);
	}
	
	try {
		var fss = fs.statSync(gjs.serverConfig.confDir+'/'+configuration);
		
		/* load configuration files */
		ret = loadGeneric(gjs.serverConfig.confDir+'/'+configuration, this);
		if(ret != true) {
			console.log(
				"Unable to read configuration"
			);
			return(false);
		}
	
	} catch(e) {
		/* file doesn't exist / do nothing */
	}

	this.rules.reload();
	
};

module.exports = site;

