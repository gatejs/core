
var serverConfig = function(bs) { return({
	serverProcess: 4,
	hostname: "testServer0",
	
	runDir: "/tmp/gatejs",
// 	libDir: __dirname,
// 	logDir: "/home/bwsfg/logs",
// 	configDir: __dirname+'/configs',
	gracefulRam: 80,
	gracefulRamForce: 90,

	
})};

module.exports = serverConfig;


