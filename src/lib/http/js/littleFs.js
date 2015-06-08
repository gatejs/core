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
	woff: 'application/x-font-woff',
	ttf: 'application/x-font-ttf',
	php: 'application/php',
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

littleFs.getMime = function(filename) {
	var ext = filename.substr(filename.lastIndexOf(".")+1);
	return(littleFs.litteFsMimes[ext.toLowerCase()]);
}

littleFs.process = function(pipe) {
	
	var request = pipe.request, response = pipe.response;
	
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
		
		var fileDateC = new Date(sS.ctime);
		var fileDateM = new Date(sS.ctime);
		
		var noBody = false;
		var inputDate = false;
		if(pipe.request.headers["if-modified-since"]) {
			inputDate = new Date(pipe.request.headers["if-modified-since"]);
		}
		
		console.log(inputDate, fileDateM);
		if(inputDate && inputDate.getTime() == fileDateM.getTime()) {
			response.writeHead(304, {
				'Content-Type': littleFs.litteFsMimes[ext],
				'Content-Length': sS.size,
				'Date': fileDateC,
				'Last-Modified': fileDateM,
				'Cache-Control': "public, max-age=604800",
				'server': 'gatejs'
			});
			response.end();
			
			if(pipe.reverse === true)
				pipe.root.lib.http.reverse.log(pipe, 304);
			else
				pipe.root.lib.http.forward.log(pipe, 304);
			
			return(true);
		}
			
		response.writeHead(200, {
			'Content-Type': littleFs.litteFsMimes[ext],
			'Content-Length': sS.size,
			'Date': fileDateC,
			'Last-Modified': fileDateM,
			'Cache-Control': "public, max-age=604800",
			'server': 'gatejs'
		});

		var readStream = fs.createReadStream(filename);
		
		if(pipe.reverse === true)
			pipe.root.lib.http.reverse.logpipe(pipe, readStream);
		else
			pipe.root.lib.http.forward.logpipe(pipe, readStream);
		
		return(true);
	}
	
	if(ret = request.urlParse.pathname.match('^'+littleFs.virtualDirectory+'(.*)'))
		return(processRendering(ret));


	return(false);
}

littleFs.register = function(rootDirectory) {
	roots.push(rootDirectory);
}

littleFs.loader = function(gjs) { 
	
	/* scan for mime.type */
	try {
		var data = fs.readFileSync('/etc/mime.types').toString();
		data = data.replace(/[\t]/g, " ").split("\n");
		for(var a in data) {
			var el = data[a];
			var pos = el.indexOf(' ');
			var contentType = el.substr(0, pos);
			if(contentType.length > 1 && contentType[0] != '#')  {
				var exts = el.substr(pos).trim().split(' ');
				if(exts.length > 0)  {
					for(var b in exts) 
						littleFs.litteFsMimes[exts[b]] = contentType;
				}
			}
		}
	} catch(e) {
		/* nothing */
	}
	
	littleFs.register(__dirname+'/fileSystem');
	
	/* generate virtualDirectory */
	var cp = crypto.createHash('sha512');
	cp.update(JSON.stringify(gjs.serverConfig));
	littleFs.virtualDirectory = '/'+cp.digest('hex');
	
}

module.exports = littleFs;

