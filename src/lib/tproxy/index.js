/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy module [http://www.binarysec.com]
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

var net = require('net');
var http = require('http');
var os = require('os');

var tproxy = function() { /* loader below */ };

if(os.platform() != 'linux') {
	tproxy.enabled = false;
	tproxy.node = false;
	tproxy.net = net;
	tproxy.httpAgent = http.Agent;
	module.exports = tproxy;
	return;
}

tproxy.enabled = true;
tproxy.node = require('./build/Release/obj.target/tproxy.node');
tproxy.net = require(__dirname+'/js/net');
tproxy.httpAgent = require(__dirname+'/js/httpAgent');

tproxy.loader = function(gjs) {
	try {
		tproxy.net.loader(gjs);
		tproxy.httpAgent.loader(gjs);
	} catch(e) {
		console.log("* Tproxy exception : ", e);
	}
}

module.exports = tproxy;
