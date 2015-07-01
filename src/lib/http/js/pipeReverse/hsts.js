var hsts = function(gjs) { }

hsts.request = function(pipe, options) {
	if(!options)
		options = {};
	
	var age, subdom, preload;
	
	age = 10512000;
	if(options.age > 0)
		age = options.age;
	
	subdom = " includeSubDomains;";
	if(options.subDomain == false)
		subdom = "";
	
	preload = " preload;";
	if(options.preload == false)
		preload = "";
	
	pipe.response.on('response', function(res, from) {
		res.gjsSetHeader("Strict-Transport-Security", "max-age="+age+subdom+preload);
	});

}

hsts.ctor = function(gjs) { }

module.exports = hsts; 
