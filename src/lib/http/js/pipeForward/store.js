/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Store cache opcode [http://www.binarysec.com]
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
 * 
 * Origin: Michael VERGOZ
 */

var util = require("util");
var http = require("http");
var fs = require("fs");
var crypto = require('crypto');
var cluster = require("cluster");
var url = require('url');

var store = function(gjs) { }

store.request = function(gjs) {
// 	console.log(gjs.request.url);
	
	/* no need to try parsing already validated by http server */
	gjs.request.urlParseCacheStore = url.parse(gjs.request.url, true);
// 	gjs.request.urlParseCacheStore.protocol = 'http:';
	
	delete gjs.request.urlParseCacheStore.hostname;
	
	gjs.request.urlParseCacheStore.host = 'store.'+gjs.request.headers.host;
	
	/* extends urlParse options */
	gjs.request.urlParseCacheStore.pathSplit = gjs.request.urlParse.pathname.split('/');

	/* basic scan */
	for(var a in store.scripts) {
		var script = store.scripts[a];
		
		var ret;
		ret = script.request(gjs);
		if(ret == true) {
			gjs.storeHit = true;
			break;
		}
	}

	return(false);
}

store.ctor = function(gjs) {
	if(cluster.isMaster)
		return;
	
	store.scriptDir = __dirname+"/store/";
	
	/* load libraries */
	store.scripts = {};
	function tryLoadLib(dir, file) {
		var filename = __dirname+'/lib/'+dir+'/'+file;
		try {
			var fss = fs.statSync(filename);
			return(filename);
		} catch(e) {
			/* file doesn't exist / do nothing */
		}
		return(false);
	}
	try {
		var d = fs.readdirSync(store.scriptDir), a;
		for(a in d)
			store.scripts[d[a]] = require(store.scriptDir+d[a]);
		
		/* post load modules */
		for(a in this.lib) {
			if(this.lib[a].loader)
				this.lib[a].loader(this);
		}
		
	} catch(e) {
// 		console.log("Can not read directory "+e.path+" with error code #"+e.code);
		return(false);
	}
	
	
	
}

module.exports = store; 
