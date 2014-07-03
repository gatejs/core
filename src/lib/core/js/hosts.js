/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core statistics [http://www.binarysec.com]
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

var fs = require('fs');
var os = require('os');

var hosts_module = function(gjs) { };
var hosts, file, loaded = false;

var detectFile = function() {
	if(os.platform() == 'linux')
		file = '/etc/hosts';
	else if(os.platform() == 'windows')
		file = 'C:\Windows\System32\drivers\etc\hosts';
	else
		file = '/etc/hosts';
}

var loadFile = function() {
	try {
		/* read file to string, replace \t to ' ' and split lines */
		var lines = fs.readFileSync(file).toString().replace(/\t/g, " ").split('\n');
		
		hosts = {};
		
		for(var i in lines) {
			
			/* if not empty and not comment */
			if(lines[i].length && lines[i][0] != '#') {
				
				/* split line and retrieve ip */
				var l = lines[i].split(' ').filter(function(a) {return a.length;});
				var ip = l.shift();
				
				/* merge or add results */
				hosts[ip] = hosts[ip] ? hosts[ip].concat(l) : l;
			}
		}
	}
	catch(e) {
		return false;
	}
}

var watchFile = function() {
	fs.watchFile(file, function(curr, prev) {
		if(curr.mtime != prev.mtime) {
			loadFile();
		}
	});
}

var resolve = function(host) {
	for(var i in hosts)
		if(hosts[i].indexOf(host) > -1)
			return i;
	return false;
}

var reverse = function(ip) {
	return hosts[ip] ? hosts[ip] : false;
}

/* add functions and export */
hosts_module.resolve = resolve;
hosts_module.reverse = reverse;
hosts_module.loader = function(gjs) {
	if(!loaded) {
		loaded = true;
		detectFile();
		loadFile();
		watchFile();
	}
}

module.exports = hosts_module;
