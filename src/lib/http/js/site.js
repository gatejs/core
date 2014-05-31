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
					
					/* inject nreg server name rules */
					if(obj.serverName) {
						if(obj.interfaces instanceof Array) {
							for(var b in obj.serverName) {
								var key = bs.lib.core.utils.cstrrev(obj.serverName[b]);
								dst.rules.add(key);
								dst.sites[key] = obj;
							}
						}
						else if(obj.interfaces instanceof String) {
							var key = bs.lib.core.utils.cstrrev(obj.serverName);
							dst.rules.add(key);
							dst.sites[key] = obj;
						}
						else
							throw('Invalid argument for serverName in '+obj.confName);
					}
					else
						throw('No serverName defined in '+obj.confName);
					
					/* format interface */
					if(obj.interfaces) {
						obj.solvedInterfaces = {};
						if(obj.interfaces instanceof Array) {
							for(var b in obj.interfaces)
								obj.solvedInterfaces[obj.interfaces[b]] = true;
						}
						else if(obj.interfaces instanceof String)
							obj.solvedInterfaces[obj.interfaces] = true;
					}
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

site.search = function(name) {
	if(!name)
		return(false);
	var pos = site.rules.match(site.gjs.lib.core.utils.cstrrev(name));
	if(pos)
		return(site.sites[pos]);
	return(false);
	
}

site.loader = function(bs) {
	var ret;

	site.gjs = bs;
	site.sites = {};
	
	/* create nreg context */
	site.rules = new bs.lib.core.nreg();
	
	/* Load opcode context */
	site.opcodes = bs.lib.core.pipeline.scanOpcodes(
		__dirname+'/pipeReverse',
		'reversing'
	);
	if(!site.opcodes) {
		gjs.lib.core.logger.error('No opcodes found for reverse proxy');
		return(false);
	}
	
	/* load configuration files */
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

