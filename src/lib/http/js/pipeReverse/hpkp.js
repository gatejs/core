var hpkp = function(gjs) { }

hpkp.request = function(pipe, options) {
	if(pipe.server.config.ssl != true)
		return;
	
	if(!pipe.site.sslSNI.fingerprint)
		return;
	
	if(!(options instanceof Object))
		options = {};
	
	var age, subdom, report;
	
	age = 10512000;
	if(options.age > 0)
		age = options.age;
	
	subdom = "";
	if(options.subDomain == true)
		subdom = " includeSubDomains;";
	
	report = "";
	if(options.report)
		report = " report-uri="+options.report+";";
	
	var pin = '';
	var hasPin = false;
	
	for(var k in pipe.site.sslSNI.fingerprint) {
		var fp = pipe.site.sslSNI.fingerprint[k];
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
		pin += "max-age="+age+subdom+report;
		pipe.response.on('response', function(res, from) {
			res.gjsSetHeader("Public-Key-Pins", pin);
		});
	}

}

hpkp.ctor = function(gjs) { }

module.exports = hpkp; 
