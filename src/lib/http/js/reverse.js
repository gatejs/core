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

  	 
reverse.loader = function(gjs) {
	if (cluster.isMaster)
		return;

// 	function lookupServername(sites, host) {
// 		for(var a in sites) {
// 			var sConf = sites[a];
// 			for(var b in sConf.serverName) {
// 				var z = sConf.serverName[b];
// 				if(z == host)
// 					return(sConf);
// 			}
// 		}
// 		return(false);
// 	}
	

	var processRequest = function(server, request, response) {
		var pipe = gjs.lib.core.pipeline.create(null, null, function() {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 513, 
				tpl: "5xx", 
				log: false,
				title:  "Pipeline terminated",
				explain: "Pipeline did not execute a breaking opcode"
			});
		});
		
		pipe.root = gjs;
		pipe.request = request;
		pipe.response = response;
		pipe.server = server;
		
		/* parse the URL */
		try {
			pipe.request.urlParse = url.parse(request.url, true);
		} catch(e) {
			gjs.lib.core.logger.error('URL Parse error on from '+request.remoteAddress);
			request.connection.destroy();
			return;
		}
		
		/* lookup little FS */
		var lfs = gjs.lib.http.littleFs.process(request, response);
		if(lfs == true)
			return;
		
		/* get iface */
		var iface = reverse.list[server.gjsKey];
		if(!iface) {
			gjs.lib.http.error.renderArray({
				pipe: pipe, 
				code: 500, 
				tpl: "5xx", 
				log: false,
				title:  "Internal server error",
				explain: "no iface found, fatal error"
			});
			gjs.lib.core.logger.error('No interface found for key '+server.gjsKey+' from '+request.remoteAddress);
			return;
		}
		pipe.iface = iface;
		
		/* lookup website */
		
		/* execute pipeline */
		pipe.resume();
		pipe.execute();
	};
	
	var slowLoris = function(socket) {
		console.log("Probable SlowLoris attack from "+socket.remoteAddress+", closing.");
		clearInterval(socket.gjs.interval);
		socket.destroy();
	}
	
	var bindHttpServer = function(key, sc) {
		console.log("Binding HTTP server on "+sc.address+":"+sc.port);
		var iface = http.createServer(function(request, response) {
// 			clearInterval(request.socket.gjs.interval);
// 			if(!currentServer.requestCount)
// 				currentServer.requestCount = 0;
			
// 			currentServer.requestCount++;
			processRequest(this, request, response);
			
		});
		
// 		iface.on('connection', (function(socket) {
// 			var date = new Date;
// 			socket.gjs = {
// 				timer: date.getTime(),
// 				interval: setInterval(slowLoris, 5000, socket)
// 			};
// 			
// 			console.log("connection");
// 		}));
		iface.gjsKey = key;
		iface.listen(sc.port, sc.address);
		
		return(iface);
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
				
				/* ok wegjsite has SNI certificate check files */
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
// 			clearInterval(request.socket.gjs.interval);
// 			if(!currentServer.requestCount)
// 				currentServer.requestCount = 0;
			
// 			currentServer.requestCount++;
			processRequest(this, request, response);
			
		});
		
// 		iface.on('connection', (function(socket) {
// 			var date = new Date;
// 			socket.gjs = {
// 				timer: date.getTime(),
// 				interval: setInterval(slowLoris, 5000, socket)
// 			};
// 			
// 			console.log("connection");
// 		}));
		iface.gjsKey = key;
		iface.listen(sc.port, sc.address);
		
		return(iface);
	}

	/*
	 * Associate interface and configuration
	 */
	function processConfiguration(key, o) {
		if(o.type == 'reverse') {
			if(!reverse.list[key]) {
				reverse.list[key] = {
					sites: [],
					ifaces: []
				};
			}
			/* defaulting */
			if(!o.address) o.address = '0.0.0.0';
			if(!o.port)
				o.port = o.ssl == true ? 443 : 80;
			if(o.ssl == true)
				reverse.list[key].ifaces.push(bindHttpsServer(key, o));
			else 
				reverse.list[key].ifaces.push(bindHttpServer(key, o));
		}
	}
	
	/* Load opcode context */
	reverse.opcodes = gjs.lib.core.pipeline.scanOpcodes(
		__dirname+'/pipeReverse',
		'reversing'
	);
	if(!reverse.opcodes)
		return(false);
	
	/* 
	 * Follow configuration
	 */
	for(var a in gjs.serverConfig.http) {
		var sc = gjs.serverConfig.http[a];
		if(sc instanceof Array) {
			for(var b in sc)
				processConfiguration(a, sc[b]);
		}
		else if(sc instanceof Object)
			processConfiguration(a, sc);
	}
	
// 	/* 
// 	 * Follow configuration
// 	 */
// 	for(var a in gjs.serverConfig.reverse) {
// 		var sc = gjs.serverConfig.reverse[a];
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
// 		/* clean wegjsite pointers */
// 		for(var key in reverse.list)
// 			reverse.list[key].sites = [];
// 	}
// 	
// 	/* handle reload */
// 	gjs.lib.gjsCore.ipc.on('SIGUSR2', doReload);
// 	gjs.lib.gjsCore.ipc.on('gjs:reload', doReload);
	
	return(false);
	
}

module.exports = reverse;

