var util = require("util");
var http = require("http");
var https = require("https");
var events = require('events');
var dns = require('dns');

var proxyPass = function() { /* loader below */ } 

proxyPass.request = function(pipe, mode) {
	
	
	function modeHost() {
		/* check host */
		if(!pipe.request.headers.host) {
			pipe.root.lib.bwsFg.httpServer.renderError({
				pipe: pipe, 
				code: 504, 
				tpl: "5xx", 
				log: true,
				title:  "Bad gateway",
				explain: "Can not resolv you Host header request"
			});
			pipe.stop();
			return(true);
		}
		
		
		/* select DNS from host */
		var tmp = pipe.request.headers.host.indexOf(':');
		var reqHost;
		var reqPort;
	
		if(tmp > 0) {
			reqHost = pipe.request.headers.host.substr(0, tmp);
			reqPort = pipe.request.headers.host.substr(tmp+1);
		}
		else {
			reqHost = pipe.request.headers.host;
			reqPort = 80;
		}
		
		if(reqPort <= 0 || reqPort >= 65535)
			reqHost = 80;
		
		pipe.pause();
		dns.resolve4(reqHost, function (err, addresses) {
			if(err) {
				pipe.root.lib.bwsFg.httpServer.renderError({
					pipe: pipe, 
					code: 504, 
					tpl: "5xx", 
					log: true,
					title:  "DNS error",
					explain: "Unable to resolv DNS entry for "+reqHost+' '+err
				});
				pipe.stop();
// 				pipe.execute();
				return(true);
			}
		
			emitDestinationRequest(addresses[0], reqPort);
		});

		/* resolving */
// 		console.log(pipe.request.headers.host);
	}

// 	if(mode == 'tproxy-dst' && pipe.root.lib.bwsFg.httpTproxy.isTproxy)
// 		modeTproxyDst();
// 	else if(mode == 'host')
// 		modeHost();
// 	else if(mode == 'tproxy-host')
// 		modeTproxyHost();
// 	else
// 		modeHost();

	
	console.log('proxyPass', mode);
	return(false);
	
}

proxyPass.ctor = function(bs) {

}

module.exports = proxyPass;


