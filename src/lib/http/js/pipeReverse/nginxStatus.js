/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * nginx status mimics opcode [http://www.binarysec.com]
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

var nginxStatus = function(gjs) { }

nginxStatus.request = function(pipe, options) {
	pipe.pause();
	pipe.root.lib.core.stats.ask([
			"gracefulActiveConnections",
			"gracefulAccepts",
			"httpRequests",
			"httpReading",
			"httpWriting",
			"httpWaiting",
		
		], function(res) {
		
			pipe.root.lib.http.reverse.log(pipe, 200);
			
			pipe.response.headers = {
				Server: "gatejs",
				Pragma: 'no-cache',
				'Cache-Control': 'max-age=0',
				'Content-Type': 'text/plain'
			};
			
			pipe.response.writeHead(200, pipe.response.headers);
			
			pipe.response.write(
				"Active connections: "+res.gracefulActiveConnections.value+"\n"+
				"server accepts handled requests\n"+
				"  "+res.gracefulAccepts.value+" "+res.gracefulAccepts.value+" "+res.httpRequests.value+"\n"+
				"Reading: "+res.httpReading.value+" Writing: "+res.httpWriting.value+" Waiting: "+res.httpWaiting.value+"\n"
			);
			pipe.response.end();
	});
	return(true);
}



nginxStatus.ctor = function(gjs) {


}

module.exports = nginxStatus;


