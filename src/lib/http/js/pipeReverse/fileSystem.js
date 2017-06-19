/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Executer opcode [http://www.binarysec.com]
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
const path = require('path');
const fs = require('fs');

var fileSystem = function(gjs) { }

fileSystem.request = function(pipe, destDir, opts) {
	pipe.stop();
	var url = path.posix.resolve('/', pipe.request.url);
	var fpath = url.replace(pipe.location.regex, destDir);
	
	if(!opts)
		opts = {};
	if(!opts.maxAge)
		opts.maxAge = 86400;
	if(!opts.skipErrors)
		opts.skipErrors = false;
	
	fs.stat(fpath, function(err, stat) {
		if(err || !stat || !stat.isFile()) {
			if(opts.skipErrors) {
				pipe.resume();
				pipe.execute();
			}
			else {
				pipe.root.lib.http.error.renderArray({
					pipe: pipe,
					code: 404,
					tpl: "4xx",
					log: true,
					title:  "Not found",
					explain: "File not found"
				});
			}
			return;
		}
		
		var mime = littleFs.getMime(fpath) || 'application/octet-stream';
		var fileDateM = stat.mtime.toGMTString();
		var inputDate = false;
		var littleFs = pipe.root.lib.http.littleFs;
		if(pipe.request.headers["if-modified-since"])
			inputDate = new Date(pipe.request.headers["if-modified-since"]).toGMTString();
		
		if(inputDate === fileDateM) {
			pipe.response.writeHead(304, {
				'Content-Type': mime,
				'Content-Length': stat.size,
				'Last-Modified': fileDateM,
				'Cache-Control': "public, max-age="+opts.maxAge,
				'server': 'gatejs'
			});
			pipe.response.end();
			
			pipe.root.lib.http.reverse.log(pipe, 304);
			
			return;
		}
		
		pipe.response.writeHead(200, {
			'Content-Type': mime,
			'Content-Length': stat.size,
			'Last-Modified': fileDateM,
			'Cache-Control': "public, max-age="+opts.maxAge,
			'server': 'gatejs'
		});
		
		var readStream = fs.createReadStream(fpath);
		
		pipe.root.lib.http.reverse.logpipe(pipe, readStream);
		
		return;
	});
}

fileSystem.upgrade = function(pipe, destDir) {
	fileSystem.request(pipe, destDir);
}


fileSystem.ctor = function(gjs) {
}

module.exports = fileSystem; 
