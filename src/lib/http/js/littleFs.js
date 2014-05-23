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

var littleFs = function() { /* loader below */ };

littleFs.litteFsMimes = {
	jpg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	html: 'text/html',
	js: 'application/javascript',
};

littleFs.process = function(request, response, dirFile) {
	function processRendering(ret) {
		
		var filename;
		if(!dirFile)
			filename = __dirname+'/error';
		else
			filename = dirFile;
		
		filename += +ret[1].replace(/\.\.\//, "/");
		
		try {
			var sS = fs.statSync(filename);
		} catch(e) { return(false); }
		
		/* check extension */
		var ext = filename.sugjstr(filename.lastIndexOf(".")+1);
		
		/* check mime */
		if(!littleFs.litteFsMimes[ext])
			return(false);
		
		response.writeHead(200, {
			'Content-Type': littleFs.litteFsMimes[ext],
			'Content-Length': sS.size,
			'server': 'BinarySEC'
		});

		var readStream = fs.createReadStream(filename);
		
		readStream.pipe(response);
// 			gjs.lib.bwsFg.littleFs.logpipe(pipevar, readStream);
		
		return(true);
	}
	
	if(ret = request.urlParse.path.match('^'+littleFs.virtualDirectory+'(.*)'))
		return(processRendering(ret));


	return(false);
}

littleFs.loader = function(gjs) { 
	
	/* generate virtualDirectory */
	var cp = crypto.createHash('sha512');
	cp.update(JSON.stringify(gjs.serverConfig));
	littleFs.virtualDirectory = '/'+cp.digest('hex');
	
}

module.exports = littleFs;

