/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Reverse proxy proxyPass opcode [http://www.binarysec.com]
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

var util = require("util");
var http = require("http");
var https = require("https");
var events = require('events');
var cluster = require("cluster");

var forwarder = require(__dirname+'/../proxy.js');

var proxyPass = function() {}

proxyPass.request = function(pipe, proxyname) {
	var reverse = pipe.root.lib.http.reverse;

	var fw = new forwarder(pipe, proxyname);
	fw.forward()
	return;
}

proxyPass.upgrade = function(pipe, proxyname) {
	return(proxyPass.request(pipe, proxyname));
}

proxyPass.ctor = function(gjs) {

	/* receive mutual faulty */
	gjs.lib.core.ipc.on('proxyPassFaulty', function(gjs, data) {
		var d = data.msg.node;
		var site = gjs.lib.http.reverse.sites.search(data.msg.site);
		if(!site)
			return;
		if(!site.proxyStream[d._name])
			return;
		if(!site.proxyStream[d._name][d._key])
			return;
		if(!site.proxyStream[d._name][d._key][d._index])
			return;
		site.proxyStream[d._name][d._key][d._index].isFaulty = true;
	});

	/* receive mutual solution */
	gjs.lib.core.ipc.on('proxyPassWork', function(gjs, data) {
		var d = data.msg.node;
		var site = gjs.lib.http.reverse.sites.search(data.msg.site);
		if(!site)
			return;
		if(!site.proxyStream[d._name])
			return;
		if(!site.proxyStream[d._name][d._key])
			return;
		if(!site.proxyStream[d._name][d._key][d._index])
			return;
		var node = site.proxyStream[d._name][d._key][d._index];
		node.isFaulty = false;
		node._retry = 0;
	});

}

module.exports = proxyPass;
