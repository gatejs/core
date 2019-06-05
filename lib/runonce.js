const fs = require("fs");
const isRunning = require("is-running");
const debug = require('debug')('gatejs:runonce');

class running {

	constructor(name, pid) {
		this.name = name;
		this.process = pid || process.pid;
		this.file = "/tmp/running-"+name+".pid";

		debug("Creating context in "+this.file);
	}

	isAlive() {
		this.inFileProcess = null;
		try {
			this.inFileProcess = fs.readFileSync(this.file);
			if(this.inFileProcess)
				this.inFileProcess = this.inFileProcess.toString();
		} catch(e) {}

		if(!this.inFileProcess)
			return(false);

		if(isRunning(this.inFileProcess))
			return(true);

		return(false);
	}

	start() {
		if(this.isAlive() === true) {
			console.log("Processing is alive from "+this.inFileProcess);
			process.exit(0);
		}

		try {
			fs.writeFileSync(this.file, this.process);
		} catch(e) {
			console.log("Can not create running context "+this.file+": "+e.message);
			process.exit(-1)
		}
		debug("Starting running checker for "+this.process+" in "+this.file);
	}

	stop() {
		debug("Stoping checker for "+this.process+" in "+this.file);
		try {
			fs.unlinkSync(this.file);
		} catch(e) {
			console.log("Can not remove running context "+this.file+": "+e.message);
			process.exit(-1)
		}
	}
}

module.exports = running;
