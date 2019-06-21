const debug = require('debug')('gatejs:core:uplink');
const gatejs = require("../index");
const crypto = require("crypto");
const EventEmitter = require("events").EventEmitter;

const Uplink = require('@gatejs/cluster').Uplink;
const fs = require("fs");

class gatejsUplink {
	constructor(kernel, options) {
		this.kernel = kernel;
		this.options = options;
		this.cost = options.cost || 100;
	}

	start(cb) {
		const self = this;

		// slaves & master are clients
		if(this.options.port) {
			debug("Running nodelink on "+this.options.address+":"+this.options.port);
			this.socket = new Uplink({
				host: this.options.address,
				port: this.options.port,
				psk: this.kernel.config.sharedKey
			});
		}
		else {
			debug("Running nodelink on "+this.options.address);
			this.socket = new Uplink({
				path: this.options.address,
				psk: this.kernel.config.sharedKey
			});
		}

		this._bindEvents(this.socket)

		if(cb) cb();
	}

	_bindEvents(socket) {
		socket.on('error', (err) => {
			debug(process.pid+" Uplink error "+self.options.address+": "+err.message)
		})
	}

}

module.exports = gatejsUplink;
