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

var pipeline = function(gjs) { /* loader below */ };

pipeline.status = {
	execute: 0,
	waiting: 1,
	stop: 2
};

function pipeline(pipe, errorFunc) {
	this.options = pipe;

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


pipeline.create = function(pipe, errorFunc) {
	return(new pipeline(pipe, errorFunc));
}


pipeline.loader = function(gjs) { }

module.exports = pipeline;


