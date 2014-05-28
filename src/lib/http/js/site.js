var fs = require("fs");
var cluster = require("cluster");
var crypto = require("crypto");

var site = function() { /* loader below */ };

function loadGeneric(bs, dir, dst) {
	try {
		var d = fs.readdirSync(dir), a;
		for(a in d) {
			if(d[a].search(/\.js$/) > 0) {
				var m = d[a].match(/(.*)\.js$/);
				var f = dir + '/' + m[1];
				
				try {
					var data = fs.readFileSync(f+'.js');
					var estr = '(function() { return('+data.toString()+'); })();';
					var obj = eval(estr);
					
					obj.confName = m[1];
					for(var b in obj.serverName) {
						var key = bs.lib.core.utils.cstrrev(obj.serverName[b]);
						dst.rules.add(key);
						dst.sites[key] = obj;
					}
					
// 					/* push site configuration */
// 					if(p.interfaces) {
// // 						if(p.interfaces instanceof Array) {
// // 							for(var z in p.interfaces)
// // 								bs.lib.bwsRg.httpServer.attachSite(p.interfaces[z], p);
// // 						}
// 					}
				}
				catch (err) {
					gjs.lib.core.logger.error("Error loading file "+f+'.js : '+err);
				}
			}
		}
	} catch(e) {
		gjs.lib.core.logger.error("Can not read directory "+e.path+" with error code #"+e.code);
		return(false);
	}
	return(true);
}
	
site.loader = function(bs) {
	var ret;

	site.sites = {};
	
	/* create nreg context */
	site.rules = new bs.lib.core.nreg();
	
// 	site.getSiteByConf = function(confname) {
// 		if(site.sites[confname])
// 			return(site.sites[confname]);
// 		return(false);
// 	}
	
	ret = loadGeneric(bs, bs.serverConfig.confDir+'/reverseSites', site);
	if(ret != true) {
		console.log(
			"Unable to read configuration"
		);
		return(false);
	}

	site.rules.reload();

	
}

module.exports = site;

