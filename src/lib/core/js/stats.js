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
var cluster = require("cluster");

var stats = function(gjs) { };

var statsData = {};

function get(name) {
	if(!statsData[name])
		statsData[name] = { value: 0 };
	return(statsData[name]);
}

function set(m) {
	var p = get(m.name);
	p.type = m.type;
	if(m.action == stats.action.add) 
		p.value += m.value;
	else if(m.action == stats.action.sub)
		p.value -= m.value;
	else if(m.action == stats.action.varAdd) {
		var d = get(m.var);
		p.value += d.value;
	}
	else if(m.action == stats.action.varSub) {
		var d = get(m.var);
		p.value = d.value-p.value;
	}
}

function merge(d, s) {
	for(var a in s) {
		if(!d[a])
			d[a] = { value: s[a].value };
		else
			d[a].value +=  s[a].value;
	}
}

stats.type = {
	gauge: 1,
	counter: 2
}

stats.action = {
	add: 0,
	sub: 1,
	varAdd: 2,
	varSub: 3
}

stats.diffuse = function(varName, action, value) {
	if(varName instanceof Array) {
		for(var a in varName)
			set(varName[a]);
		return;
	}
	set({
		name: varName,
		action: action,
		value: value
	});
}

/* callback has one arg 'data' */
stats.ask = function(varList, callback) {
	var msg = {
		session: 'core:stats:get:'+Math.random(),
		vars: varList
	};
	
	var stillWaiting = stats.gjs.serverConfig.serverProcess;
	var ret = {};
	merge(ret, statsData);
	function receive(sgjs, data) {
		stillWaiting--;
		merge(ret, data.msg);
		if(stillWaiting == 0) {
			callback(ret);
			stats.gjs.lib.core.ipc.removeListener(msg.session, receive);
		}
	}
	stats.gjs.lib.core.ipc.on(msg.session, receive);
	stats.gjs.lib.core.ipc.send('LFW', 'core:stats:get', msg);
}

stats.loader = function(gjs) {
	stats.gjs = gjs;
	gjs.lib.core.ipc.on('core:stats:get', function(sgjs, data) {
		var m = data.msg;
		var ret = {};
		for(var a in m.vars) {
			var k = m.vars[a];
			if(statsData[k])
				ret[k] = statsData[k];
			else
				ret[k] = { value: 0 };
		}
		stats.gjs.lib.core.ipc.send('LFW', m.session, ret);
	});
}

module.exports = stats;


