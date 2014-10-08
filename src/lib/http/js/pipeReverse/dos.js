var util = require("util");
var http = require("http");
var cluster = require("cluster");

var dosTab = {}

function selectZone(pipe, zone) {
	var ret;
	if(!dosTab.hasOwnProperty(zone)) 
		dosTab[zone] = {};
	ret = dosTab[zone];
	return(ret);
}

function selectIP(szone, ip, time) {
	if(!szone.hasOwnProperty(ip)) 
		ret = szone[ip] = {
			_address: ip,
			_banned: false,
			_hit: 0,
			_count: 0,
			_first: time
		};
	ret = szone[ip];
	return(ret);
}

var dos = function(gjs) { }

dos.request = function(pipe, options) {
	var date = new Date;
	var now = date.getTime();
	
	/* select the zone */
	var selectedZone = false;
	if(pipe.reverse == true)
		var selectedZone = selectZone(pipe.root, pipe.site.name);
	if(!selectedZone)
		selectedZone = selectZone(pipe.root, 'global');
	
	/* log for the IP */
	var selectedIP = selectIP(selectedZone, pipe.request.connection.remoteAddress, now);
	
	/* default options  */
	if(!options.markPoints)
		options.markPoints = 250;
	if(!options.rps)
		options.rps = 100;
	if(!options.banTime)
		options.banTime = 60;
	if(!options.disableBlacklist)
		options.disableBlacklist = false;
	
	/* increase IP access */
	selectedIP._count++;
	
	var bannedPage = function(log) {
		pipe.root.lib.http.error.renderArray({
			pipe: pipe, 
			code: 429, 
			tpl: "4xx", 
			log: true,
			title:  "Too Many Requests",
			explain: "Too many requests received from your host "+
				pipe.request.connection.remoteAddress+
				".",
		});
	};
	
	selectedIP._last = now;
	
	/* check the req rate */
	var diff = selectedIP._last-selectedIP._first;

	/* display banned page */
	if(selectedIP._banned == true) {
		/* continue to incrase blacklist */
		if(diff > 1000) {
			if(options.disableBlacklist != true && selectedIP._count > options.rps) {
				pipe.root.lib.core.blacklist.message(
					pipe.request.connection.remoteAddress,
					'HTTP Denial of service',
					options.markPoints
				);
			}
			
			/* no worrie reset counter */
			selectedIP._first = now;
			selectedIP._count = 0;
		}
		
		pipe.stop();
		bannedPage(false);
		return(true);
	}
	
	if(diff > 1000) {

		if(selectedIP._count > options.rps) {
			/* ban for 60 seconds */

// 			/* ok IP will be bannd for 60 seconds */
// 			if(selectedIP._hit > 0) {
// 				pipe.root.lib.core.logger.siteInfo(
// 					pipe.site.serverName[0], 
// 					"DOS attempt from address "+
// 						pipe.request.connection.remoteAddress+" which has been bannned for 60secs"
// 				);
				
			/* send IPC message to tell banned IP */
			pipe.root.lib.core.ipc.send('FFW', 'DOS', {
				serverName: pipe.site.name,
				ip: pipe.request.connection.remoteAddress
			});
			
			if(options.disableBlacklist != true)
				pipe.root.lib.core.blacklist.message(
					pipe.request.connection.remoteAddress,
					'HTTP Denial of service', 
					options.markPoints
				);
			
			selectedIP._stopTime = now;
			selectedIP._banned = true;
			selectedIP._banTime = options.banTime*1000;
			bannedPage(true);
			pipe.stop();
			return(true);

		}
		
		/* no worrie reset counter */
		selectedIP._first = now;
		selectedIP._count = 0;
	}
	
	return(false);
	
}

function bsBwsDosBackground(bs) {
	var date = new Date;
	var now = date.getTime();
	var zoneName, b, zone, ip;

	for(zoneName in dosTab) {
		zone = dosTab[zoneName];

		for(b in zone) {
			ip = zone[b];

			if(ip._banned && (ip._banTime-((now-ip._stopTime))) <= 0) {

// 				bs.lib.bsCore.logger.siteInfo(
// 					zoneName, 
// 					"Release IP address "+ip._address+" from application layer ban"
// 				);
				delete zone[b];
			}
			else {
				/* remove IP if not yet connected */
				if(now-ip._last > ip._banTime)
					delete zone[b];
			}
		}
	}
}

dos.ctor = function(gjs) {

	/* start background process */
	setInterval(bsBwsDosBackground, 10000, gjs);

}

module.exports = dos;


