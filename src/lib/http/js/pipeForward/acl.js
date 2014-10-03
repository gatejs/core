var acl = function(gjs) { }

acl.request = function(gjs, options) {
	
	var ipaddr = gjs.root.lib.core.ipaddr;
	
	/* compilation step */
	if(!options.__built)  {
		options.__ipaddr = new gjs.root.lib.ipaddr;
		options.__default = true;
		options.__rangeList = [];
		
		for(var a in options) {
			var action = options[a];
			
			if(a.toLowerCase() == "default")
				options.__default = action;
			else {
				if(options[a] == true) {
					if(!options.__ipaddr.add(a))
						gjs.root.lib.core.logger.error('Unable to add ACL '+a);
				}
			}
		}
		
		options.__built = true;
		options.__ipaddr.dump();
	}
	
	/* checking step */
	var result = options.__ipaddr.search(gjs.request.remoteAddress);
	if(!result) {
		gjs.root.lib.http.error.renderArray({
			pipe: gjs, 
			code: 403, 
			tpl: "4xx", 
			log: true,
			title:  "Forbidden",
			explain: "You don't have permission to access on this server"
		});
		gjs.stop();
		return(true);
	}
	
	
}

acl.ctor = function(gjs) {

	
	
}

module.exports = acl; 
