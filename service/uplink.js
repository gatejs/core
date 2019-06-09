const debug = require('debug')('gatejs:core:uplink');
const gatejs = require("../index");

const Socket = require('fast-tcp').Socket;
const fs = require("fs");


class gatejsUplink {
	constructor(options) {
		this.options = options;
	}

	start(cb) {
		const self = this;
		var beatTimer = null;

		// slaves & master are clients
		if(this.options.port) {
			debug("Running uplink on "+this.options.address+":"+this.options.port);
			this.socket = new Socket({
				host: this.options.address,
				port: this.options.port,
			});
		}
		else {
			debug("Running uplink on "+this.options.address);
			this.socket = new Socket({path: this.options.address});
		}

		this.socket.on('connect', () => {
			debug("Uplink connected using circuit "+self.socket.id)

			// join my own circuit
			//socket.join(socket.id);

			// join stored current circuits
			//for(var a in self.circuits) socket.join(a)
		})

		this.socket.on('end', () => {
			//delete self.circuits[socket.id];
			debug("Uplink disconnected from circuit "+self.socket.id)
		})

		this.socket.on('error', (err) => {
			console.log(self.options)
			debug(process.pid+" Uplink error "+self.options.address+": "+err.message)
		})


		if(cb) cb();
	}
}

module.exports = gatejsUplink;
