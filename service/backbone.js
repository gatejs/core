const debug = require('debug')('gatejs:core:backbone');
const gatejs = require("../index");
const EventEmitter = require("events").EventEmitter;
const Graph = require('node-dijkstra')

class gatejsBackbone extends EventEmitter {
	constructor(kernel) {
		super()
		this.kernel = kernel;

		this.sockets = {};
		this.routers = {};
		this.address = {};
		this.graph = new Graph()
		this.path = {}


		setInterval(() => {
			console.log(this.path)
		}, 2000)

	}

	registerSocket(dst, socket) {
		this.sockets[dst] = socket;

		console.log("Register socket");
	}

	unregisterSocket(dst) {
		delete this.sockets[dst];

		console.log("Unregister socket");

	}

	addNode(from, address, cost) {
		// no need
		if(from == this.kernel.config.hostname) return;

		// allocate router
		if(!this.routers[from]) this.routers[from] = {}
		const r = this.routers[from];
		if(!r[address]) {
			r[address] = cost;

			// join local hostname to new router
			var o = {}
			o[from] = 1;
			this.graph.addNode(this.kernel.config.hostname, o)
		}

		// allocate address
		if(!this.address[address]) this.address[address] = {}
		const a = this.address[address];
		if(!a[from]) a[from] = cost;

		// add graph node
		this.graph.addNode(from, r)

		// compute routing path
		this.path[address] = this.graph.path(this.kernel.config.hostname, address, {trim: true});
		this.emit("path", address, this.path[address], this.sockets[from])

		debug("Adding node from "+from+" to "+address+" with cost "+cost);
	}

	deleteNode(from, address) {
		if(!this.routers[from]) this.routers[from] = {}
		const r = this.routers[from];

		if(address) {
			//if(!r[address]) delete r[address];
			this._doDelete(from, address)
		}
		else if(this.routers[from]) {
			for(var a in this.routers[from]) {
				this._doDelete(from, a)
			}
		}
	}

	_doDelete(from, address) {
		if(!this.routers[from]) return;
		const r = this.routers[from];
		if(!r[address]) return;

		if(!this.address[address]) return;
		const a = this.address[address];
		if(!a[from]) return;

		delete r[address];
		delete a[from];

		// add graph node
		if(Object.keys(r).length === 0) this.graph.removeNode(from)
		else this.graph.addNode(from, r)

		// compute routing path
		this.path[address] = this.graph.path(this.kernel.config.hostname, address, {trim: true});
		if(this.path[address] === null) delete this.path[address];
		this.emit("path", address, this.path[address], this.sockets[from])

		// recompute address
		debug("Delete node from "+from+" to "+address);
	}
}

module.exports = gatejsBackbone;
