const debug = require('debug')('gatejs:core:nodelink');
const gatejs = require("../index");
const crypto = require("crypto");

const Socket = require('fast-tcp').Socket;
const fs = require("fs");

const gatejsNode = require("./node");

class gatejsNodelink extends gatejsNode {
	constructor(kernel, options) {
		super()
		this.circuits = {};
		this.type = "nodelink";
		this.kernel = kernel;
		this.options = options;
	}

	start(cb) {
		const self = this;
		var beatTimer = null;

		// slaves & master are clients
		if(this.options.port) {
			debug("Running nodelink on "+this.options.address+":"+this.options.port);
			this.socket = new Socket({
				host: this.options.address,
				port: this.options.port,
			});
		}
		else {
			debug("Running nodelink on "+this.options.address);
			this.socket = new Socket({path: this.options.address});
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

			// join my own circuit
			//socket.join(socket.id);

			// join stored current circuits
			for(var a in self.circuits) socket.join(a)
		})

		socket.on('end', () => {
			debug("Nodelink disconnected from circuit "+socket.id)
		})

		socket.on('error', (err) => {
			debug(process.pid+" Nodelink error "+self.options.address+": "+err.message)
		})

		// authentitifcation
		socket.on('seed', (seed) => {
			debug("Got seed from router "+seed);

			// compute hmac
			const hmac = crypto.createHmac('sha256', self.kernel.config.sharedKey);
			hmac.update(seed);
			socket.emit("hmac", hmac.digest('hex'))
			socket.emit("type", "nodelink")
		})

		socket.on('play', (address) => {

		})

		socket.on('node/add', (node) => {
			debug(process.pid+" add node ", node)
		})

		socket.on('node/remove', (node) => {
			debug(process.pid+" remove node ", node)
		})

		socket.on('test', (node) => {
			debug(process.pid+" test ", node)
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
