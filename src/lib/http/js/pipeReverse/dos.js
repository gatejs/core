var util = require("util");
var http = require("http");
var cluster = require("cluster");

var dosTab = {};
var builtWhiteLists = {};

function loadWLZone(root, zone, addresses) {
	var ret;
	if(!builtWhiteLists.hasOwnProperty(zone)) {
		builtWhiteLists[zone] = root.lib.ipaddr();
		for(var i = 0 ; i < addresses.length ; i++) {
			builtWhiteLists[zone].add(addresses[i]);
		}
	}
	ret = builtWhiteLists[zone];
	return(ret);
}

function selectZone(pipe, zone) {
	var ret;
	if(!dosTab.hasOwnProperty(zone))
		dosTab[zone] = {};
	ret = dosTab[zone];
	return(ret);
}

function selectIP(szone, ip, time) {
	var ret;
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
	var remoteIP = pipe.request.remoteAddress;

	if(!remoteIP)
		return(false);
		
	/* select the zone */
	var selectedZone = false;
	if(pipe.reverse == true)
		var selectedZone = selectZone(pipe.root, pipe.site.name);
	if(!selectedZone)
		selectedZone = selectZone(pipe.root, 'global');

	if(!options)
		options = {};

	if(!options.whiteList)
		options.whiteList = [];

	if(pipe.reverse == true)
		var selectedWLZone = loadWLZone(pipe.root, pipe.site.name, options.whiteList);
	if(!selectedWLZone)
		selectedWLZone = loadWLZone(pipe.root, 'global', options.whiteList);

	if(selectedWLZone.search(remoteIP))
		return(false);

	/* log for the IP */
	var selectedIP = selectIP(selectedZone, remoteIP, now);

	/* default options  */
	if(!options.markPoints)
		options.markPoints = 1000;
	if(!options.rps)
		options.rps = 25;
	if(!options.banTime)
		options.banTime = 60;
	if(!options.disableBlacklist)
		options.disableBlacklist = false;

	/* increase IP access */
	selectedIP._count++;

	function bannedPage(log) {
		pipe.root.lib.http.error.renderArray({
			pipe: pipe,
			code: 429,
			tpl: "4xx",
			log: log,
			title:  "Too Many Requests",
			explain: "Too many requests received from your host "+
				remoteIP+
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
					remoteIP,
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

			/* send IPC message to tell banned IP */
			pipe.root.lib.core.ipc.send('FFW', 'DOS', {
				serverName: pipe.site.name,
				rps: selectedIP._count,
				limit: options.rps,
				ip: remoteIP
			});

			if(options.disableBlacklist != true)
				pipe.root.lib.core.blacklist.message(
					remoteIP,
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

				bs.lib.core.ipc.send('FFW', 'DOSUNBAN', {
					serverName: zoneName,
					ip: ip._address
				});

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

dos.upgrade = function(gjs, options) {
	return(dos.request(gjs, options));
}

dos.ctor = function(gjs) {

	/* start background process */
	setInterval(bsBwsDosBackground, 10000, gjs);

}

module.exports = dos;
