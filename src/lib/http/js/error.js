/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * HTTP serving [http://www.binarysec.com]
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

var error = function() { /* loader below */ };

var roots = [];

function fileExists(filename) {
	try {
		var sS = fs.statSync(filename);
	} catch(e) {
		return(false); 
	}
	return(sS);
}

error.renderArray = function(msg, file) {
	var pipe = msg.pipe;
	var filename;
	
	if(file) {
		filename = file;
	}
	else {
		var found = false;
		for(var a in roots) {
			var filename = roots[a]+"/"+msg.tpl+".tpl";
			var r = fileExists(filename);
			if(r != false) {
				found = true;
				break;
			}
		}
		if(found == false) {
			pipe.response.writeHead(500);
			pipe.response.write("Can not find template "+msg.tpl);
			pipe.response.end();
			return(false);
		}
	}

	/* internal log */
	if(msg.log == true) {
		if(msg.pipe.forward)
			msg.pipe.root.lib.http.forward.log(msg.pipe, msg.code);
		else if(msg.pipe.reverse)
			msg.pipe.root.lib.http.reverse.log(msg.pipe, msg.code);
		else if(msg.pipe.service) {
			// todo
		}
		
	}
	msg.pipe.response.headers = {
		server: "gatejs",
		pragma: 'no-cache',
		connection: 'close',
		'cache-control': 'max-age=0'
	};
	
	pipe.stop();
	pipe.response.writeHead(msg.code, msg.pipe.response.headers);
	
	msg.vd = msg.pipe.root.lib.http.littleFs.virtualDirectory;
	
	var stream = msg.pipe.root.lib.mu2.compileAndRender(filename, msg);
	
	stream.pipe(pipe.response);
}

error.loader = function(gjs) {
	/* register local files */
	error.register(__dirname+"/errorPages");
};

error.register = function(dir) {
	roots.unshift(dir);
};

module.exports = error;

