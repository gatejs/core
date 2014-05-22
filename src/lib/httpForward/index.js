/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core engine [http://www.binarysec.com]
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

// var cluster = require('cluster');
var net = require('net');
// var events = require('events');
// var eventEmitter = new events.EventEmitter();

var httpForward = function() { /* loader below */ };

// // var binding = require(__dirname+'/build/Release/httpForward.node');
// try {
// 	httpForward.httpTproxy = require(__dirname+'/js/httpTproxy');
// } catch(e) {
// 	console.log("! httpForward tproxy exeption\n", e);
// }
// httpForward.httpServer = require(__dirname+'/js/httpServer');
// httpForward.acn = require(__dirname+'/js/acn.js');

// console.log(binding);

httpForward.loader = function(bs) {
// 	try {
// 		httpForward.httpTproxy.loader(bs);
// 		httpForward.httpServer.loader(bs);
// 		httpForward.acn.loader(bs);
// 	} catch(e) {
// 		console.log("###################\n", e);
// 	}
}

module.exports = httpForward;
