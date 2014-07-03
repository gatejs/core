/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy http agent patch code [http://www.binarysec.com]
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

var nodeHttp = require('http');
var util = require('util');

var httpAgent = function() {
	var lThis = this;
	var t = new nodeHttp.Agent;
	for(var a in t)
		this[a] = t[a];
	
	this.tproxy = function() {
		this.createConnection = createTproxyConnection;
	}
	
};

function createTproxyConnection() {
	var args = normalizeConnectArgs(arguments);
	
	//console.log("DEBUG: MONIP", arguments[0].localAddress);
	var fd = tproxy.newTproxyClientFD(arguments[0].localAddress, 0);
	
	arguments[0].localAddress = undefined;
	
	var s = new net.Socket({fd: fd});
	
	//var s = new net.Socket(args[0]);
	return net.Socket.prototype.connect.apply(s, args);
};

// Returns an array [options] or [options, cb]
// It is the same as the argument of Socket.prototype.connect().
function normalizeConnectArgs(args) {
	var options = {};
	if(typeof args[0] === 'object') {
		// connect(options, [cb])
		options = args[0];
	} 
	else if (isPipeName(args[0])) {
		// connect(path, [cb]);
		options.path = args[0];
	} 
	else {
		// connect(port, [host], [cb])
		options.port = args[0];
		if (typeof args[1] === 'string') {
			options.host = args[1];
		}
	}

	var cb = args[args.length - 1];
	return (typeof cb === 'function') ? [options, cb] : [options];
}

httpAgent.loader = function(gjs) { }

module.exports = httpAgent;
