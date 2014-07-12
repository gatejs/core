/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * scanFileOnDisk opcode [http://www.binarysec.com]
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

var fs = require('fs');

var scanFileOnDisk = function(gjs) { }

scanFileOnDisk.request = function(pipe, options) {
	
	if(!pipe.location.documentRoot)
		return(false);
	
	pipe.request.urlParse.path = decodeURI(pipe.request.urlParse.path);
	pipe.file = pipe.location.documentRoot+
		pipe.request.urlParse.path.replace(/\.\.\//, "/");
	console.log(pipe.file);
	try {
		pipe.fileInfo = fs.statSync(pipe.file);
	} catch(e) {
		delete pipe.fileInfo;
	}
	
	if(!pipe.fileInfo)
		return(true);
	
	/* check for default files */
	if(pipe.fileInfo.isDirectory()) {
		
		if(pipe.location.defaultDocument instanceof Array) {
			for(var a in pipe.location.defaultDocument) {
				var file = pipe.file+'/'+pipe.location.defaultDocument[a];
				try {
					var tmpFileInfo = fs.statSync(file);
					pipe.file = file;
					pipe.fileInfo = tmpFileInfo;
					break;
				} catch(e) { }
			}
		}
		else if(pipe.location.defaultDocument instanceof String) {
			var file = pipe.file+'/'+pipe.location.defaultDocument;
			try {
				var tmpFileInfo = fs.statSync(file);
				pipe.file = file;
				pipe.fileInfo = tmpFileInfo;
			} catch(e) { }
				
		}
	}

}

scanFileOnDisk.ctor = function(gjs) {


}

module.exports = scanFileOnDisk;


