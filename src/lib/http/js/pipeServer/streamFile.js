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

var fs = require('fs');

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
	
	/** \todo check permissions */
	
	/* get mime */
	var mime = pipe.root.lib.http.littleFs.getMime(pipe.file);
	if(!mime)
		mime = 'text/plain';
	
	
	/* prepare header for 304 */
	if(
		pipe.request.headers['if-modified-since'] == pipe.fileInfo.mtime & 
		(pipe.request.headers.pragma != 'no-cache' || pipe.request.headers['cache-control'] != 'no-cache')
		) {
		var headers = {
			Server: 'gatejs',
			'Content-Type': mime,
			'Last-Modified': pipe.fileInfo.mtime
		}
		pipe.stop();
		pipe.response.writeHead(304, headers);
		pipe.response.end();
		return(false);
	}
	
	/* prepare header for 200 */
	var now = new Date;
	var cacheDelay = Math.round((now-pipe.fileInfo.mtime)/1000/100);
	var headers = {
		Server: 'gatejs',
		'Content-Length': pipe.fileInfo.size,
		'Content-Type': mime,
		'Last-Modified': pipe.fileInfo.mtime,
		'Cache-Control': "public, max-age="+cacheDelay
	}
	if(
		pipe.server.isClosing == true || 
		pipe.request.headers.connection == 'close' ||
		(pipe.request.httpVersion == '1.0' && !pipe.request.headers.connection)
		) {
		header['Connection'] = 'Close';
	}

	var st = fs.createReadStream(pipe.file);
	
	pipe.stop();
	pipe.response.writeHead(200, headers);
	st.pipe(pipe.response);
}

streamFile.ctor = function(gjs) {


}

module.exports = streamFile;


