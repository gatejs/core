/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Headers opcode [http://www.binarysec.com]
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

var headers = function(pipe) { }

headers.request = function(pipe, opts) {
	function response() {
		pipe.response.on('response', function(res, from) {
			for(var a in opts.set)
				res.gjsSetHeader(a, opts.set[a]);
		
			for(var a in opts.hide)
				res.gjsRemoveHeader(opts.hide[a]);
		});
	}
	
	function request() {
		for(var a in opts.set)
			pipe.request.gjsSetHeader(a, opts.set[a]);
		
		for(var a in opts.hide)
			pipe.request.gjsRemoveHeader(opts.hide[a]);
	}
	
	/* select assignation */
	var mode = response;
	if(opts.request == true)
		mode = request;
	mode();
	
	return(false);
}

headers.ctor = function(gjs) {
	headers.gjs = gjs;
}

module.exports = headers; 
