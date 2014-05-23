/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy net module patch code [http://www.binarysec.com]
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

var nodeNet = require('net');

var net = function() { /* loader below */ };

// var binding = require(__dirname+'/build/Release/net.node');
try {
	net.httpTproxy = require(__dirname+'/js/httpTproxy');
} catch(e) {
	console.log("* net module exeption", e);
}
// net.httpServer = require(__dirname+'/js/httpServer');
// net.acn = require(__dirname+'/js/acn.js');

net.loader = function(bs) {
	try {

	} catch(e) {

	}
}

module.exports = net;
