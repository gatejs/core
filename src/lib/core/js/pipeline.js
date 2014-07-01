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
var pipeline = function(gjs) { this.gjs = gjs; };

pipeline.status = {
	execute: 0,
	waiting: 1,
	stop: 2
};

function pipelineObject(opcodes, line, errorFunc) {
	this.pipe = [];
	this.pipeIdx = 0;
	
	if(line && opcodes && line.resolved != true) {
		var lPipe = [];
		for(var a in line) {
			for(var b in line[a]) {
				var insert = [];
				var op = line[a][b];
				/* check opcode */
				if(!opcodes[op[0]]) {
					console.log('no opcode calls '+op[0]+' please check your configuration');
					break;
				}
				insert[0] = opcodes[op[0]];
				for(var c=1; c<op.length; c++)
					insert.push(op[c]);
				
				if(insert.length > 0)
					lPipe.push(insert);
			}
		}
		line.solved = lPipe;
		line.resolved = true;
	}

	if(line && line.solved)
		this.pipe = line.solved;
	
	this.update = function(opcodes, line) {
		if(!line || !opcodes)
			return(false);
		if(line.resolved == true) {
			this.pipe = line.solved;
			return(false);
		}
		var lPipe = [];
		for(var a in line) {
			var insert = [];
			var op = line[a];
			/* check opcode */
			if(!opcodes[op[0]]) {
				console.log('no opcode calls '+op[0]+' please check your configuration');
				break;
			}
			insert[0] = opcodes[op[0]];
			for(var c=1; c<op.length; c++)
				insert.push(op[c]);
			
			if(insert.length > 0)
				lPipe.push(insert);
		}
		line.solved = lPipe;
		line.resolved = true;
		this.pipe = line.solved;
	}
	
	this.stop = function() {
		/* stop execution */
		this.pipeStatus = pipeline.status.stop;
// 		this.execute();
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
		if(this.pipe) {
			for(; this.pipeIdx < this.pipe.length;) {
				var func = this.pipe[this.pipeIdx];
				var arg = [this];
				for(var a=1; a<func.length; a++)
					arg.push(func[a]);
				this.pipeIdx++;
				func[0].request.apply(null, arg);
				if(this.pipeStatus == pipeline.status.stop)
					return(true);
				else if(this.pipeStatus == pipeline.status.waiting)
					return(true);
			}
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
	
	if(!name)
		return(opcodes[scanDir]);
	
	try {
		var d = fs.readdirSync(scanDir), a;
		for(a in d) {
			if(d[a].search(/\.js$/) > 0) {
				var m = d[a].match(/(.*)\.js$/);
				var f = scanDir + '/' + m[1];
				if(!opcodes[name][m[1]]) {
					opcodes[name][m[1]] = require(f);
					if(opcodes[name][m[1]].ctor)
						opcodes[name][m[1]].ctor(pipeline.gjs);
				}
			}
		}
	} catch(e) {
		pipeline.gjs.lib.core.logger.error("Can not read directory "+e.path+" with error code #"+e);
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


