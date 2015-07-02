var hpkp = function(gjs) { }

hpkp.request = function(pipe, options) {
	if(pipe.server.config.ssl != true || pipe.site._hpkpError == true)
		return;
	
	var pSSL;
	
	/* SNI switch */
	if(!pipe.site.sslSNI)
		pSSL = pipe.server.config;
	else 
		pSSL = pipe.site.sslSNI;
	
	if(!(options instanceof Object))
		options = {};
	
	var age, subdom, backup, report;
	
	age = 10512000;
	if(options.age > 0)
		age = options.age;
	
	subdom = "";
	if(options.subDomain == true)
		subdom = " includeSubDomains;";
	
	report = "";
	if(options.report)
		report = " report-uri="+options.report+";";
	
	if(!options.backup) {
		pipe.root.lib.core.logger.error("HPKP error for site "+pipe.site.name+": You must defined a backup PIN - rfc7469 section 4.3");
		pipe.site._hpkpError = true;
		return;
	}
	
	/* cache base64 encoding */
	if(!pipe.site._hpkpBackup)
		pipe.site._hpkpBackup = new Buffer(options.backup, "hex").toString("base64");
	
	var pin = 'max-age='+age+'; ';
	var hasPin = false;
	
	for(var k in pSSL.fingerprint) {
		var fp = pSSL.fingerprint[k];
		if(fp instanceof Buffer) {
			pin += 'pin-sha256="'+fp.toString("base64")+'"; ';
			hasPin = true;
		}
		else if(fp instanceof Array) {
			for(var sk in fp) {
				var fpp = fp[sk];
				if(fpp instanceof Buffer) {
					pin += 'pin-sha256="'+fpp.toString("base64")+'"; ';
					hasPin = true;
				}
			}
		}
	}

	if(hasPin == true) {
		/* backup Pin + options */
		pin += 'pin-sha256="'+pipe.site._hpkpBackup.toString("base64")+'"; '+subdom+report;
		
		/* set response header */
		pipe.response.on('response', function(res, from) {
			res.gjsSetHeader("Public-Key-Pins", pin);
		});
	}

}

hpkp.ctor = function(gjs) { }

module.exports = hpkp; 
