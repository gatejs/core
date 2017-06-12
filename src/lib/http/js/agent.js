/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Global agent manager [http://www.binarysec.com]
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

var http = require('http');
var https = require('https');
var spdy = require('spdy');

var agent = function() { /* loader below */ };

agent.loader = function(gjs) {

	function fixDefault(src) {
		src.maxFreeSockets = 128;
		src.keepAlive = true;
		src.keepAliveMsecs = 30000;
	}

	function applyConfig(src, config) {
		if(typeof config === 'number') {
			if(config > 0)
				src.maxFreeSockets = config;
		}
		else if(typeof config === 'object') {
			if(config.hasOwnProperty("keepAlive"))
				src.keepAlive = config.keepAlive;
			if(config.keepAliveMsecs && config.keepAliveMsecs > 0)
				src.keepAliveMsecs = config.keepAliveMsecs;
		}
	}

	fixDefault(http.globalAgent);
	fixDefault(https.globalAgent);

	if(gjs.serverConfig.agent) {
		if(gjs.serverConfig.agent.http)
			applyConfig(http.globalAgent, gjs.serverConfig.agent.http);
		if(gjs.serverConfig.agent.https)
			applyConfig(https.globalAgent, gjs.serverConfig.agent.https);
	}

/*
	if(gjs.lib.tproxy.enabled == true) {
		agent.http = new gjs.lib.tproxy.httpAgent;
		agent.http.is = 'http';
		agent.https = new gjs.lib.tproxy.httpAgent;
		agent.https.is = 'https';
		agent.spdy = new gjs.lib.tproxy.httpAgent;
		agent.spdy.is = 'spdy';
		agent.httpTproxy = new gjs.lib.tproxy.httpAgent;
		agent.httpTproxy.is = 'httpTproxy';
		agent.httpsTproxy = new gjs.lib.tproxy.httpAgent;
		agent.httpsTproxy.is = 'httpsTproxy';
		agent.spdyTproxy = new gjs.lib.tproxy.httpAgent;
		agent.spdyTproxy.is = 'spdyTproxy';

		agent.httpTproxy.tproxy();
		agent.httpsTproxy.tproxy();
	}
*/

}

module.exports = agent;
