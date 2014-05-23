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
var error = function() { /* loader below */ };


error.renderArray = function(msg) {
	var filename = __dirname+'/errorPages/'+msg.tpl.replace(/\.\.\//, "/")+'.tpl';
	var pipe = msg.pipe;
	
	msg.pipe.response.headers = {
		server: "gatejs",
		pragma: 'no-cache',
		connection: 'close',
		'cache-control': 'max-age=0'
	};
	
	pipe.response.writeHead(msg.code, msg.pipe.response.headers);
	
	msg.vd = msg.pipe.root.lib.http.littleFs.virtualDirectory;

	var stream = msg.pipe.root.lib.mu2.compileAndRender(filename, msg);

	stream.pipe(pipe.response);

}

error.loader = function(gjs) { }

module.exports = error;

