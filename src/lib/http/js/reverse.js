var http = require("http");
var https = require("https");
var url = require("url");
var cluster = require("cluster");
var fs = require("fs");
var crypto = require("crypto");

var reverse = function() { /* loader below */ };

reverse.list = {};
reverse.sockets = [];

reverse.attachSite = function(key, config) {
	if(!reverse.list[key]) {
// 		console.log("Unknown http configuration "+key);
		return(false);
	}

	reverse.list[key].sites.push(config);
	return(true);
}

  	 
reverse.loader = function(bs) {
	if (cluster.isMaster)
		return;

	function lookupServername(sites, host) {
		for(var a in sites) {
			var sConf = sites[a];
			for(var b in sConf.serverName) {
				var z = sConf.serverName[b];
				if(z == host)
					return(sConf);
			}
		}
		return(false);
	}
	

	var processRequest = function(server, request, response) {

	};
	
	var slowLoris = function(socket) {
		console.log("Probable SlowLoris attack from "+socket.remoteAddress+", closing.");
		clearInterval(socket.bwsRg.interval);
		socket.destroy();
	}
	
	var bindHttpServer = function(key, sc) {
		console.log("Binding HTTP server on "+sc.address+":"+sc.port);
		var iface = http.createServer(function(request, response) {
// 			clearInterval(request.socket.bwsRg.interval);
// 			if(!currentServer.requestCount)
// 				currentServer.requestCount = 0;
			
// 			currentServer.requestCount++;
			processRequest(this, request, response);
			
		});
		
// 		iface.on('connection', (function(socket) {
// 			var date = new Date;
// 			socket.bwsRg = {
// 				timer: date.getTime(),
// 				interval: setInterval(slowLoris, 5000, socket)
// 			};
// 			
// 			console.log("connection");
// 		}));
		iface.bwsRgKey = key;
		iface.listen(sc.port, sc.address);
		
		return(iface);
	}
	
	var lookupSSLFile = function(options) {
		/* ca and crl as possible array */
		var root = bs.serverConfig.libDir+'/ssl';
		var keyLookup = ['cert', 'ca', 'pfx', 'key'];
		for(var a in keyLookup) {
			var z = keyLookup[a];
			if(options[z]) {
				var file = root+'/'+options[z];
				try {
					var fss = fs.statSync(file);
					options[z] = fs.readFileSync(file);
					
				} catch(e) {
					console.log('Can not open '+file+' '+e);
					return(false);
				}
			}
		}
		return(true);
		
	}
	
	var bindHttpsServer = function(key, sc) {
		if(!lookupSSLFile(sc)) {
			console.log("Can not create HTTPS server on "+sc.address+':'+sc.port);
			return(false);
		}
		
		sc.SNICallback = function(hostname) {
			var sites = reverse.list[key].sites;
			var site = lookupServername(sites, hostname);
			if(site && site.sslSNI) {
				/* can not use SNI  */
				if(site.sslSNI.usable == false)
					return(false);
				
				/* SNI resolved */
				if(site.sslSNI.resolv)
					return(site.sslSNI.crypto.context);
				
				/* ok website has SNI certificate check files */
				if(!lookupSSLFile(site.sslSNI)) {
					site.sslSNI.usable = false;
					site.sslSNI.resolv = true;
					return(false);
				}
				site.sslSNI.usable = true;
				site.sslSNI.resolv = true;
				
				/* associate crypto Credentials */
				site.sslSNI.crypto = crypto.createCredentials(site.sslSNI);
				return(site.sslSNI.crypto.context);
			}
		}
		
		console.log("Binding HTTPS server on "+sc.address+":"+sc.port);
		var iface = https.createServer(sc, function(request, response) {
// 			clearInterval(request.socket.bwsRg.interval);
// 			if(!currentServer.requestCount)
// 				currentServer.requestCount = 0;
			
// 			currentServer.requestCount++;
			processRequest(this, request, response);
			
		});
		
// 		iface.on('connection', (function(socket) {
// 			var date = new Date;
// 			socket.bwsRg = {
// 				timer: date.getTime(),
// 				interval: setInterval(slowLoris, 5000, socket)
// 			};
// 			
// 			console.log("connection");
// 		}));
		iface.bwsRgKey = key;
		iface.listen(sc.port, sc.address);
		
		return(iface);
	}
	
// 	/*
// 	 * Associate interface and configuration
// 	 */
// 	function processConfiguration(key, o) {
// 		
// 		if(!reverse.list[key]) {
// 			reverse.list[key] = {
// 				sites: [],
// 				ifaces: []
// 			};
// 		}
// 		if(o.type == 'http')
// 			reverse.list[key].ifaces.push(bindHttpServer(key, o));
// 		else if(o.type == 'https')
// 			reverse.list[key].ifaces.push(bindHttpsServer(key, o));
// 	}
// 	
// 	/* 
// 	 * Follow configuration
// 	 */
// 	for(var a in bs.serverConfig.reverse) {
// 		var sc = bs.serverConfig.reverse[a];
// 		if(sc instanceof Array) {
// 			for(var b in sc)
// 				processConfiguration(a, sc[b]);
// 		}
// 		else if(sc instanceof Object)
// 			processConfiguration(a, sc);
// 	}
// 	
// 	function doReload() {
// 		var ret;
// 		
// 		/* clean website pointers */
// 		for(var key in reverse.list)
// 			reverse.list[key].sites = [];
// 	}
// 	
// 	/* handle reload */
// 	bs.lib.bsCore.ipc.on('SIGUSR2', doReload);
// 	bs.lib.bsCore.ipc.on('bwsRg:reload', doReload);
	
	return(false);
	
}

module.exports = reverse;

