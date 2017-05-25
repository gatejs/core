/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * GZIP opcode [http://www.binarysec.com]
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

var zlib = require('zlib');

var gzip = function(pipe) { }

gzip.contentType = {
	'application/javascript': true,
	'text/plain': true,
	'text/html': true,
	'text/css': true,
};

gzip.request = function(pipe, opts) {
	var options = { };

	if(opts.level)
		options.level = opts.level;
	
	if(opts.memLevel)
		options.memLevel = opts.memLevel;
	
	var typesTab = gzip.contentType;
	if(opts.types)
		typesTab = opts.types;
	
	/* check if browser support gzip */
	var ae = pipe.request.headers['accept-encoding'];
	if(ae) {
		var s = ae.split(', ');
		var set = false;
		for(var i in s) {
			if(s[i] == 'gzip') {
				set = true;
				break;
			}
		}
		if(set != true) 
			return(false);
	}
	
	/* will check response headers */
	pipe.response.on('response', function(res, from) {
		var ct = res.headers['content-type'];
		
		if(typesTab[ct] && !res.headers['content-encoding']) {

			res.gjsSetHeader('Vary', 'Accept-Encoding');
			res.gjsSetHeader('Content-Encoding', 'gzip');
			res.gjsRemoveHeader('content-length');
			
			pipe.subPipe = zlib.createGzip(options);

			res.pipe(pipe.subPipe);
		}
	});
}

gzip.ctor = function(gjs) { }

module.exports = gzip; 
