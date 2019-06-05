const fs = require("fs");
const debug = require('debug')('gatejs:isolate');
const { spawn } = require('child_process');

class isolate {
	//--max-old-space-size=8192
	constructor(worker, program) {
		this.worker = worker;
		this.program = program;

		this.args = [].concat(process.execArgv).concat(program.split(" "))

		debug("Adding isolate process "+program);

		setTimeout(() => {
			this.spawn()
		});
	}


	spawn() {
		const parent = spawn(process.argv[0], this.args);

		parent.stdout.on('data', (data) => {
			debug((`stdout: ${data}`).trim());
		});

		parent.stderr.on('data', (data) => {
			debug((`stderr: ${data}`).trim());
		});

		parent.on('close', (code) => {
			console.log(`child process exited with code ${code}`);
		});
	}
}

module.exports = isolate;
