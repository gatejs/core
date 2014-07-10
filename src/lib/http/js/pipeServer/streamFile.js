/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * streamFile opcode [http://www.binarysec.com]
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
var cluster = require("cluster");

var streamFile = function(gjs) { }

streamFile.request = function(pipe, options) {
	
	if(!pipe.fileInfo) {
		pipe.stop();
		pipe.root.lib.http.error.renderArray({
			pipe: pipe, 
			code: 404, 
			tpl: "4xx", 
			log: true,
			title:  "Not found",
			explain: "File not found"
		});
		return(false);
	}
	
	
	
}

streamFile.ctor = function(gjs) {


}

module.exports = streamFile;


