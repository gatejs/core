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
					dst[m[1]] = eval(estr);
					var p = dst[m[1]];
					p.confName = m[1];
					
					/* push site configuration */
					if(p.interfaces) {
						if(p.interfaces instanceof Array) {
							for(var z in p.interfaces)
								bs.lib.bwsRg.httpServer.attachSite(p.interfaces[z], p);
						}
					}
					
					/* generate virtual directory */
					var cp = crypto.createHash('sha256');
					cp.update(JSON.stringify(p));
					p.virtualDirectory = '/'+cp.digest('hex');
					
					/* create random version */
					p.version = Math.round(Math.random()*999999999999999999);
				}
				catch (err) {
					console.log("error read "+f);
				}

				
			}
		}
	} catch(e) {
		console.log("Can not read directory "+e.path+" with error code #"+e.code);
		return(false);
	}
	return(true);
}
	
site.loader = function(bs) {
	var ret;

	site.sites = {};
	
	
// 	site.getSiteByConf = function(confname) {
// 		if(site.sites[confname])
// 			return(site.sites[confname]);
// 		return(false);
// 	}
// 	
// 	ret = loadGeneric(bs, bs.serverConfig.configDir, site.sites);
// 	if(ret != true) {
// 		console.log(
// 			"Unable to read configuration"
// 		);
// 		return(false);
// 	}
	

	
}

module.exports = site;

