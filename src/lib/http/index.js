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

var http = function() { /* loader below */ };

http.log = require(__dirname+'/js/log');
http.littleFs = require(__dirname+'/js/littleFs');
http.error = require(__dirname+'/js/error');
http.forward = require(__dirname+'/js/forward');

http.loader = function(gjs) {
	try {
		http.log.loader(gjs);
		http.littleFs.loader(gjs);
		http.error.loader(gjs);
		http.forward.loader(gjs);
	} catch(e) {
		console.log("* HTTP exeption\n", e);
	}
}

module.exports = http;
