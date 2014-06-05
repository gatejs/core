var serverConfig = function(bs) { return({
	serverProcess: 4,
	hostname: "testServer0",
	runDir: "%PREFIX_VAR%/run/gatejs",
	dataDir: "%PREFIX_DATA%",
	logDir: "%PREFIX_VAR%/log/gatejs",
	confDir: '%PREFIX_CONF%/gatejs',
	
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


