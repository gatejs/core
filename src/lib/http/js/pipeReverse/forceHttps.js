/*
 * Copyright (c) 2010-2017 BinarySEC SAS
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

const fs = require('fs');

var satForceHttps = function(gjs) { };

satForceHttps.request = function(pipe, permanent) {

	// defaulting option to false
	if(permanent !== true)
		permanent = 302;
	else
		permanent = 301;

	if(pipe.server.config.ssl !== true) {
		// disabled for the moment
		//var m = pipe.request.method.toLowerCase();
		//if(m == "get" || m == "post") {
			var hdr = {
				Server: 'gatejs',
				Location: 'https://'+pipe.request.headers.host+pipe.request.url
			}
			pipe.response.writeHead(permanent, "Forced HTTPS", hdr);
			pipe.response.end();
			pipe.stop();
			return;
		//}
	}
};

satForceHttps.ctor = function(gjs) { };
module.exports = satForceHttps;
