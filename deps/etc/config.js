var serverConfig = function(bs) { return({
	serverProcess: 4,
	hostname: "testServer0",
	runDir: "/tmp/gatejs",
	dataDir: "/home/bwsfg",
	logDir: "/var/log/gatejs",
	confDir: '/home/mykii/Documents/share',
	
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
			['cache', { }],
			['proxyPass', { mode: 'host', timeout: 10 }]
		],
	}

	
})};

module.exports = serverConfig;


