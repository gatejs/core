const logger = require("./lib/index");

module.exports = (kernel, cb) => {

	kernel.registerWorker({
		name: "Local File Logger",
		file: __dirname+"/worker/service.js"
	})

	kernel.registerLibrary("log", new logger(kernel))

	cb();
}
