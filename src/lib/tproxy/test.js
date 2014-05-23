var httproxy = require('./js/httproxy.js');

//Client:
var req = httproxy.request({
	createConnection: httproxy.createTproxyConnection,
	agent: false,
	hostname: 'ifconfig.me',
	host: '49.212.149.105',
	port: 80,
	path: '/ip',
	tproxy_addr: '41.213.181.29',
	tproxy_port: 0,
}, function(res) {
	//console.log("RAIE PONCE", res);
	res.on('data', function (chunk) {
		console.log('BODY: ' + chunk);
	});
});

req.end();

//Server:
/*var s = httproxy.createServer(function(c) {
	console.log("COONIKTI");
});

s.on('request', function(req, res) {
	console.log(req.client.address());
	console.log(httproxy.getTproxyRealDest(req.client._handle.fd));
	console.log("REQRES");
});

s.tproxyListen('0.0.0.0', 80, 511, function() {
	console.log("LIISNING", arguments);
});*/
