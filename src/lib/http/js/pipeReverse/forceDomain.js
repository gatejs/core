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

var satForceDomain = function(gjs) { };

satForceDomain.request = function(pipe, options) {
	var permanent = false;
	var domain = null;

	// select permanent option
	if(options && options.permanent)
		permanent = options.permanent;

	// defaulting option to false
	permanent = permanent !== true ? 302 : 301;

	// select domain option
	if(options.domain)
		domain = options.domain;

	// if no domain provided return
	if(!domain)
		return;

	var m = pipe.request.method.toLowerCase();
	var d = pipe.request.headers.host.toLowerCase();
	if(m == "get" && d != domain) {
		var http = "http";
		if(pipe.server.config.ssl == true)
			http = "https";

		var hdr = {
			Server: 'gatejs',
			Location: http+'://'+domain+pipe.request.url
		}
		pipe.response.writeHead(permanent, "Forced Domain", hdr);
		pipe.response.end();
		pipe.stop();
		return;
	}

};

satForceDomain.ctor = function(gjs) { };
module.exports = satForceDomain;
