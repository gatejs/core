const debug = require('debug')('gatejs:core:nodelink');
const gatejs = require("../index");
const crypto = require("crypto");

const Socket = require('@gatejs/cluster').Socket;
const fs = require("fs");

class gatejsNodelink  {
	constructor(kernel, options) {
		this.circuits = {};
		this.type = "nodelink";
		this.kernel = kernel;
		this.options = options;
	}

	start(cb) {
		const self = this;

		// slaves & master are clients
		if(this.options.port) {
			debug("Running nodelink on "+this.options.address+":"+this.options.port);
			this.socket = new Socket({
				host: this.options.address,
				port: this.options.port,
				psk: this.kernel.config.sharedKey
			});
		}
		else {
			debug("Running nodelink on "+this.options.address);
			this.socket = new Socket({
				path: this.options.address,
				psk: this.kernel.config.sharedKey
			});
		}

		this._bindEvents(this.socket)

		if(cb) cb();
	}

	on(event, cb) {
		this.socket.on(event, cb)
	}

	emit(event, data, opts) {
		this.socket.emit(event, data, opts)
	}

	_bindEvents(socket) {
		const self = this;

		socket.on('connect', () => {
			debug("Nodelink connected using circuit "+socket.id)

			// join stored current circuits
			for(var a in self.circuits) socket.join(a)
		})

		socket.on('end', () => {
			debug("Nodelink disconnected from circuit "+socket.id)
		})

		socket.on('error', (err) => {
			debug(process.pid+" Nodelink error "+self.options.address+": "+err.message)
		})

		socket.on('play', (address) => {

		})

	}


	join(name) {
		var p = this.circuits[name];
		if(p === true) {
			return;
		}
		debug(`PID ${process.pid} joins ${name}`);
		this.circuits[name] = true;
		this.socket.join(name);
	}

	leave(name) {
		var p = this.circuits[name];
		if(p !== true) {
			return;
		}
		debug(`PID ${process.pid} leaves ${name}`);
		this.circuits[name] = false;
		this.socket.leave(name);
	}



}

module.exports = gatejsNodelink;
