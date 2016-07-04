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

headers.request = function(pipe, headerName) {
	
	if(!headerName)
		headerName = "X-Real-Ip";
	
	var ip = pipe.request.connection.remoteAddress;
	
	pipe.request.gjsSetHeader(headerName, ip);
	
	return(false);
};

headers.upgrade = function(gjs, options) {
	return(headers.request(gjs, options));
}

headers.ctor = function(gjs) {

};

module.exports = headers; 
