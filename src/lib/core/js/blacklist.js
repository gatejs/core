/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Backlist [http://www.binarysec.com]
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

var cluster = require("cluster");
var cp = require('child_process');
var os = require('os');

var blacklistDrvLinux = function(gjs) {
	var chainName = 'GATEJS';
	
	this.initialize = function(newChain) {
		if(newChain)
			chainName = newChain;
		/* initialize iptables */
		var ipt = 
			'iptables -N '+chainName+'; '+
			'iptables -F '+chainName+'; ';
		cp.exec(ipt);
	}
	
	this.ban = function(ip) {
		var ipt = 
			'iptables -A '+chainName+' -s '+ip+' -j DROP; '+
			'iptables -A '+chainName+' -d '+ip+' -j DROP';
		cp.exec(ipt);
	}
	
	this.unBan = function(ip) {
		var ipt = 
			'iptables -D '+chainName+' -s '+ip+' -j DROP; '+
			'iptables -D '+chainName+' -d '+ip+' -j DROP';
		cp.exec(ipt);
	}
	
}


var blacklist = function(gjs) { /* loader below */ };

blacklist.spawnMaster = function(gjs) {

	var core = gjs.lib.core;
	
	/* select os engine */
	blacklist.engine = false;
	if(os.type() == 'Linux')
		blacklist.engine = new blacklistDrvLinux(gjs);
	
	if(blacklist.engine == false)
		return;
	
	blacklist.engine.initialize();
	
	if(!gjs.serverConfig.blacklist)
		return;
	
	if(!gjs.serverConfig.blacklist.maxPoint)
		 gjs.serverConfig.blacklist.maxPoint = 10000;
	
	if(!gjs.serverConfig.blacklist.reducePoint)
		gjs.serverConfig.blacklist.reducePoint = 1000;
	
	if(!gjs.serverConfig.blacklist.l3BanTime)
		gjs.serverConfig.blacklist.l3BanTime = 300;
	
	/* initialize iptables */
	blacklist.inTable = {};
	
	function lookupIP(ip) {
		if(!blacklist.inTable[ip])
			blacklist.inTable[ip] = {
				ip: ip, why: [], 
				points: 0, banned: false
			};
		return(blacklist.inTable[ip]);
	}
	
	function lookupWhy(ipTab, why) {
		if(!ipTab.why[why])
			ipTab.why[why] = true;
		return(true);
	}
	
	function processMessage(msg) {
		var ip = lookupIP(msg.ip);
		lookupWhy(ip, msg.why);
		ip.points += msg.points;
		
// 		gjs.lib.core.ipScore.pushAlert(
// 			msg.ip, 
// 			core.ipScore.level.pass, 
// 			'Warning before L3 ban because '+msg.why
// 		);
		
		if(ip.points > gjs.serverConfig.blacklist.maxPoint)
			doBan(ip, msg);
	}
	
	function doBan(ip, msg) {
		var date = new Date;
		var now = date.getTime();
		
		if(ip.banned == true)
			return;
		
		blacklist.engine.ban(ip.ip);
		ip.banned = true;
		ip.banTime = now;
		
		var why = new String;
		for(var w in ip.why)
			why += w+' ';
			
		gjs.lib.core.logger.system(
			"IP "+ip.ip+' has been blacklisted on layer 3 within '+
			gjs.serverConfig.blacklist.l3BanTime+' seconds because '+
			why
		);
		
// 		gjs.lib.core.ipScore.pushAlert(
// 			ip, 
// 			core.ipScore.level.ban, 
// 			'L3 firewall in response of '+msg
// 		);
		
		/* send far message if forward is false */
		if(msg.forward == false) {
			gjs.lib.core.ipc.send('FFW', 'BAN', {
				ip: ip.ip, 
				why: why,
				points: ip.points,
				forward: true
			});
		}
	}
	
	function backgroundBanner() {
		var date = new Date;
		var now = date.getTime();
		
		for(var a in blacklist.inTable) {
			var el = blacklist.inTable[a];
		
			if(el.banned == false)
				el.points -= gjs.serverConfig.blacklist.reducePoint;
			else {
				if(now-el.banTime > gjs.serverConfig.blacklist.l3BanTime*1000) {
					blacklist.engine.unBan(el.ip);
					
					gjs.lib.core.logger.system(
						"Layer 3 Blacklist on IP "+el.ip+' has been released'
					);
					delete blacklist.inTable[a];
				}
			}
		}
	}

	gjs.lib.core.ipc.on('BAN', function(gjs, data) {
		processMessage(data.msg);
	});
	
	blacklist.message = function(ip, why, points) {
		processMessage({
			ip: ip,
			why: why,
			points: points
		});
	}
	setInterval(backgroundBanner, 60000);

}

blacklist.spawnSlave = function(gjs) {
	blacklist.message = function(ip, why, points) {
		if(!points)
			points = 1;
		gjs.lib.core.ipc.send('LFW', 'BAN', {
			ip: ip, why: why,
			 points: points
		});
	}
}

blacklist.loader = function(gjs) {
	
	if(cluster.isMaster)
		blacklist.spawnMaster(gjs);
	else
		blacklist.spawnSlave(gjs);
	
}


module.exports = blacklist;


