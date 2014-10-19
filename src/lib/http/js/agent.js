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
var agent = function() { /* loader below */ };

function processConfig(dst, src) {
	if(src.max) 
		dst.maxSockets = src;
	else
		dst.maxSockets = 15;
		
}

agent.loader = function(gjs) { 

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
	
	if(gjs.serverConfig.agent) {
		if(gjs.serverConfig.agent.http)
			processConfig(agent.http, gjs.serverConfig.agent.http);
		if(gjs.serverConfig.agent.https)
			processConfig(agent.https, gjs.serverConfig.agent.https);
		if(gjs.serverConfig.agent.spdy)
			processConfig(agent.spdy, gjs.serverConfig.agent.spdy);
		
		if(gjs.serverConfig.agent.httpTproxy)
			processConfig(agent.httpTproxy, gjs.serverConfig.agent.httpTproxy);
		if(gjs.serverConfig.agent.https)
			processConfig(agent.httpsTproxy, gjs.serverConfig.agent.httpsTproxy);
		if(gjs.serverConfig.agent.spdyTproxy)
			processConfig(agent.spdyTproxy, gjs.serverConfig.agent.spdyTproxy);
		
		
	}

}



module.exports = agent;

