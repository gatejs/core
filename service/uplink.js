const debug = require('debug')('gatejs:core:uplink');
const gatejs = require("../index");
const crypto = require("crypto");
const EventEmitter = require("events").EventEmitter;
const Graph = require('node-dijkstra')

const Socket = require('fast-tcp').Socket;
const fs = require("fs");


const route = new Graph()
/*
route.addNode('host1', { host2:10, host3:200 })

//route.addNode('host1', { host3:1 })
route.addNode('host1', { host3:200 })

route.addNode('host2', { host4:1, host1:1 })
route.addNode('host3', { host4:1, host1:1 })

route.addNode('host4', { host2:1, host3:1, host5: 1 })

route.addNode('host5', { host4:1 })


console.log(route.path('host1', 'host4'))
//console.log(route.path('host4', 'host1', {trim: true}))



route.addNode('host1', { host2:10, host3:200 })
route.addNode('host1', { host2:10, host3:1 })
//route.addNode('host1', { host3:200 })

route.addNode('host2', { host4:1, host1:1 })
route.addNode('host3', { host4:1, host1:1 })

route.addNode('host4', { host2:1, host3:1, host5: 1 })

route.addNode('host5', { host4:1 })


console.log(route.path('host1', 'host5'))


process.exit(0);
*/

class gatejsUplinkRelay extends EventEmitter {
	constructor(uplink) {
		super()
		this.uplink = uplink;
		this.sockets = {}
		this.rooms = {};
	}

	emit(event, data, opts) {
		console.log('up link emission')
	}
}

class gatejsUplink {
	constructor(kernel, options) {
		this.kernel = kernel;
		this.options = options;
		this.cost = options.cost || 100;

		this.relay = new gatejsUplinkRelay(this);
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

	_bindEvents(socket) {
		const self = this;

		socket.on('connect', () => {
			debug("Uplink connected using circuit "+socket.id)

			// join my own circuit
			//socket.join(socket.id);

			// join stored current circuits
			for(var a in self.circuits) socket.join(a)
		})

		socket.on('end', () => {
			debug("Uplink disconnected from circuit "+socket.id)

			// remove all nodes comming from remote hostname
			if(self.hostname) {
				self.kernel.backbone.deleteNode(
					self.hostname
				);

				self.kernel.backbone.unregisterSocket(
					self.hostname
				);
			}
		})

		socket.on('error', (err) => {
			debug(process.pid+" Uplink error "+self.options.address+": "+err.message)
		})

		// authentitifcation
		socket.on('seed', (seed) => {
			debug("Got seed from router "+seed);

			// compute hmac
			const hmac = crypto.createHmac('sha256', self.kernel.config.sharedKey);
			hmac.update(seed);
			socket.emit("hmac", hmac.digest('hex'))
			socket.emit("host", self.kernel.config.hostname)
			socket.emit("type", "uplink")

			// send my nodes execpt current hostname
		})

		socket.on('host', (hostname) => {
			self.hostname = hostname;
			self.kernel.backbone.registerSocket(
				self.hostname,
				socket
			);
			console.log("Uplink hostname "+hostname);
		})

		socket.on('play', (address) => {
			console.log("PLAY");
			// send local phy
		})

		socket.on('node/add', (node) => {
			// apply local cost
			node.cost += self.cost;

			self.kernel.backbone.addNode(
				self.hostname,
				node.id,
				node.cost
			);
			console.log(process.pid+" add virtual node ", node)
		})

		socket.on('node/remove', (node) => {
			self.kernel.backbone.deleteNode(
				self.hostname,
				node.id
			);

			console.log(process.pid+" remove virtual node ", node)
		})

	}

}

module.exports = gatejsUplink;
