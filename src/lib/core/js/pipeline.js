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

var fs = require('fs');
var pipeline = function(gjs) { };

pipeline.status = {
	execute: 0,
	waiting: 1,
	stop: 2
};

function pipelineObject(opcodes, line, errorFunc) {
	this.opcodes = opcodes;
	this.line = line;
	this.pipe = [];
	this.pipeIdx = 0;
	
	if(line.resolved != true) {
		console.log(opcodes);
		console.log(line);
		
		
		for(var a in line) {
			var l = line[a];
			for(var b in line[a]) {
				var op = line[a][b];
				console.log(op);
			}
			
		}
		
// 		console.log('resolved');
		line.resolved = true;
	}
	this.stop = function() {
		/* stop execution */
		this.pipeStatus = pipeline.status.stop;
		this.execute();
	}
	
	this.pause = function() {
		/* wait for non blocking operation */
		this.pipeStatus = pipeline.status.waiting;
	}
	
	this.resume = function() {
		/* continue to execute pipeline */
		this.pipeStatus = pipeline.status.execute;
	}
	
	this.execute = function() {
		for(; this.pipeIdx < this.pipe.length;) {
			var arg = this.pipe[this.pipeIdx];
			var aloneArg = [];
			aloneArg.push(this);
			for(var a = 1; arg instanceof Array && a<arg.length; a++) 
				aloneArg.push(arg[a]);

			this.pipeIdx++;
			var func = arg[0];
			func.apply(null, aloneArg);
		
			if(this.pipeStatus == pipeline.status.stop)
				return(true);
			else if(this.pipeStatus == pipeline.status.waiting)
				return(true);
		}
	
		if(errorFunc)
			errorFunc.apply(null, this);
		
		return(false);
	}
}


pipeline.create = function(opcodes, line, errorFunc) {
	return(new pipelineObject(opcodes, line, errorFunc));
}


var opcodes = {};
var globalLines = {};

pipeline.scanOpcodes = function(scanDir, name) {
	/* get configuration pipeline */
	if(!opcodes[name])
		opcodes[name] = {};
	try {
		var d = fs.readdirSync(scanDir), a;
		for(a in d) {
			if(d[a].search(/\.js$/) > 0) {
				var m = d[a].match(/(.*)\.js$/);
				var f = scanDir + '/' + m[1];
				opcodes[name][m[1]] = require(f);
				opcodes[name][m[1]].ctor(pipeline.gjs);
			}
		}
	} catch(e) {
		this.gjs.lib.core.logger.error("Can not read directory "+e.path+" with error code #"+e.code);
		return(false);
	}
	
	return(opcodes[name]);
}

pipeline.getGlobalPipe = function(name) {
	if(!pipeline.gjs.serverConfig.pipeline)
		return(false);
	
	if(!pipeline.gjs.serverConfig.pipeline[name])
		return(false);
	
	if(globalLines[name])
		return(globalLines[name]);
	
	globalLines[name] = {
		resolved: false,
		items: pipeline.gjs.serverConfig.pipeline[name]
	};

	return(globalLines[name]);
	
}

pipeline.loader = function(gjs) { 
	pipeline.gjs = gjs;
}

module.exports = pipeline;


