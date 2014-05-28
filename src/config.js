
var serverConfig = function(bs) { return({
	serverProcess: 4,
	hostname: "testServer0",
	
	runDir: "/tmp/gatejs",
	dataDir: "/home/bwsfg",
	logDir: "/var/log/gatejs",
// 	configDir: __dirname+'/configs',
	gracefulRam: 80,
	gracefulRamForce: 90,
	
	http: {
		forwardInterface: {
			type: 'forward',
			port: 8080,
			pipeline: 'pipetest'
		},
		reverseInterface: {
			type: 'reverse',
		}
	},
	
	pipeline: {
		pipetest: [
			['store', 'argtest1', 'argtest2'],
			['cache', { }],
			['proxyPass', { mode: 'host', timeout: 10 }]
		],
	}

	
})};

module.exports = serverConfig;


