var fs = require("fs");
var cluster = require("cluster");
var crypto = require("crypto");
var http = require('http');

var site = function() { /* loader below */ };

function loadGeneric(gjs, dir, dst) {
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
								var key = gjs.lib.core.utils.cstrrev(obj.serverName[b]);
								dst.rules.add(key);
								dst.sites[key] = obj;
							}
						}
						else if(obj.interfaces instanceof String) {
							var key = gjs.lib.core.utils.cstrrev(obj.serverName);
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
					
					/* format proxy stream */
					if(obj.proxyStream) {
						for(var a in obj.proxyStream) {
							var nodes = obj.proxyStream[a];
							function formatProxy(key) {
								if(!nodes[key])
									return;
								var servers = nodes[key];
								for(var b in servers) {
									var node = servers[b];
									node._name = a;
									node._key = key;
									node._index = b;
								}
							}
							formatProxy('primary');
							formatProxy('secondary');
						}
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

site.loader = function(gjs) {
	
	var ret;

	site.gjs = gjs;
	site.sites = {};
	
	/* create nreg context */
	site.rules = new gjs.lib.core.nreg();
	
	/* Load opcode context */
	site.opcodes = gjs.lib.core.pipeline.scanOpcodes(
		__dirname+'/pipeReverse',
		'reversing'
	);
	if(!site.opcodes) {
		gjs.lib.core.logger.error('No opcodes found for reverse proxy');
		return(false);
	}
	
	try {
		var fss = fs.statSync(gjs.serverConfig.confDir+'/reverseSites');
		
		/* load configuration files */
		ret = loadGeneric(gjs, gjs.serverConfig.confDir+'/reverseSites', site);
		if(ret != true) {
			console.log(
				"Unable to read configuration"
			);
			return(false);
		}
	
	} catch(e) {
		/* file doesn't exist / do nothing */
	}

	site.rules.reload();
	
	/* faulty checker */
	if(cluster.isMaster) {
		site.faulty = {};
		
		function backgroundChecker(input) {
			var node = input.msg.node;
			var options = {
				host: node.host,
				port: node.port,
				path: '/',
				method: 'GET',
				headers: {
					Host: input.msg.site,
					"User-Agent": "gatejs monitor"
				},
				rejectUnauthorized: false,
				servername: input.msg.site,
				agent: false
			};
			
			var flowSelect = http;
			if(node.https == true)
				flowSelect = https;
			
			var context = site.faulty[input.hash];
			var subHash = input.site.confName+node._name+node._key+node._index;
			var siteHash = context[subHash];

			var req = flowSelect.request(options, function(res) {
				
				for(var a in context) {
					var b = context[a];
					if(a.substr(0, 1) != '_') {
						gjs.lib.core.ipc.send('LFW', 'proxyPassWork', {
							site: b._site,
							node: b
						});
					}
				}
				
				delete site.faulty[input.hash];
			});
			
			req.on('error', function (error) {
			});

			function socketErrorDetection(socket) {
				req.abort();
				socket.destroy();
				clearTimeout(socket.timeoutId); 
				context._timer = setTimeout(
					backgroundChecker,
					1000,
					input
				);
			}
			
			req.on('socket', function (socket) {
				if(!socket.connected) 
					socket.connected = false;

				socket.timeoutId = setTimeout(
					socketErrorDetection, 
					10000, 
					socket
				);
				socket.on('connect', function() {
					socket.connected = true;
					clearTimeout(socket.timeoutId); 
				});
			});
			req.end();
		
		}
		
		gjs.lib.core.ipc.on('proxyPassFaulty', function(gjs, data) {
			var d = data.msg.node;
			var s = site.search(data.msg.site);
			if(!s)
				return;
			
			/* group by ip and port */
			var hash = d.host+':'+d.port;
			if(!site.faulty[hash]) {
				site.faulty[hash] = {
					_host: d.host,
					_port: d.port,
					_timer: setTimeout(
						backgroundChecker,
						2000,
						{hash: hash, msg: data.msg, site: s }
					)
				};
			}
			var context = site.faulty[hash];
			var subHash = s.confName+d._name+d._key+d._index;
			if(context[subHash])
				return;
			var siteHash = context[subHash] = d;
			
			siteHash._site = data.msg.site;
		});
	}
	
	
	
}

module.exports = site;

