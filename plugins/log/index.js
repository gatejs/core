const logger = require("./lib/index");
const service = require("./isolate/service");

module.exports = (kernel, cb) => {


	kernel.registerWorker({
		scope: "machine",
		pool: "log",
		name: "Local File Logger",
		file: __dirname+"/isolate/service.js"
	})


	kernel.registerWorker({
		scope: "machine",
		pool: "test",
		name: "Local Test program",
		file: __dirname+"/isolate/test.js"
	})


	kernel.registerLibrary("log", new logger(kernel))

	cb();
}
