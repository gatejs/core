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
var crypto = require('crypto');
var fs = require('fs');

var littleFs = function() { /* loader below */ };

littleFs.litteFsMimes = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	html: 'text/html',
	css: 'text/css',
	js: 'application/javascript',
	woff: 'application/x-font-woff'
};

var roots = [];

function fileExists(filename) {
	try {
		var sS = fs.statSync(filename);
	} catch(e) {
		return(false); 
	}
	return(sS);
}

littleFs.process = function(request, response, dirFile) {
	function processRendering(ret) {
		var filename;
		var sS;
		var found = false;
		for(var a in roots) {
			var sf = roots[a]+ret[1].replace(/\.\.\//, "/");
			var r = fileExists(sf);
			if(r != false) {
				sS = r;
				filename = sf;
				found = true;
			}
		}
		if(found == false)
			return(false);

		/* check extension */
		var ext = filename.substr(filename.lastIndexOf(".")+1);

		/* check mime */
		if(!littleFs.litteFsMimes[ext])
			return(false);
		
		response.writeHead(200, {
			'Content-Type': littleFs.litteFsMimes[ext],
			'Content-Length': sS.size,
			'server': 'gatejs'
		});

		var readStream = fs.createReadStream(filename);
		
		readStream.pipe(response);
		
		return(true);
	}
	
	if(ret = request.urlParse.path.match('^'+littleFs.virtualDirectory+'(.*)'))
		return(processRendering(ret));


	return(false);
}

littleFs.register = function(rootDirectory) {
	roots.push(rootDirectory);
}

littleFs.loader = function(gjs) { 
	
	/* generate virtualDirectory */
	var cp = crypto.createHash('sha512');
	cp.update(JSON.stringify(gjs.serverConfig));
	littleFs.virtualDirectory = '/'+cp.digest('hex');
	
}

module.exports = littleFs;

