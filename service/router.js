const debug = require('debug')('gatejs:core:router');
const gatejs = require("../index");
const fs = require("fs");
const cluster = require("cluster");
const crypto = require("crypto");

const jen = require("node-jen")();

const gatejsNode = require("./node");

const Router = require('fast-tcp').Router;

class gatejsRouter extends Router {
	constructor(kernel) {
		super();

		this.kernel = kernel;
		this.phyNodes = {}
		this.context = {}

		const self = this;

		this.on('connection', function (socket) {
			self.preAuthCommands(socket);
			/*
			socket.on('room-watch', function () {
				for(var a in server.rooms) {
					var p = server.rooms[a];
					socket.emit('room-new', {name: a, local: true})
				}
			});
			*/
			socket.on('end', function () {
				if(socket.type == "nodelink" && socket.id) {
					// send brodcast
					delete self.phyNodes[socket.id];
					self.emit('node/remove', socket.id, {broadcast: true})
				}

				debug("Disconnection ID "+socket.id);
			});


			socket.on('error', (err) => {
				console.log("Socket error "+err.message);
			})

		});

		this.on('error', (err) => {
			console.log("Server error "+err.message, err);
		})
	}

	uplinkCommands(socket) {

	}

	//
	//
	// Node information
	nodeCommands(socket) {
		debug("Allocating address for socket "+socket.id);
		const self = this;

		// prepare socket
		socket.type = "nodelink"
		socket.context = {};

		// when new enroled worker register
		socket.on('worker/context/activate', (data) => {
			data.room = "context/";
			data.room += data.scope === "machine" ? "machine/"+data.host : "cluster";
			data.address = data.room+"/"+data.pool;

			// global level
			if(!self.context[data.address])
				self.context[data.address] = Object.assign({ref: 0}, data);
			self.context[data.address].ref++;

			// socket level
			if(!socket.context[data.address])
				socket.context[data.address] = Object.assign({ref: 0}, data);
			socket.context[data.address].ref++;

			self.emit("kernel/context/state", self.context[data.address], {rooms: [data.room]})
		});

		// forward context deactivation
		socket.on('worker/context/deactivate', (data) => {
			data.room = "context/";
			data.room += data.scope === "machine" ? "machine/"+data.host : "cluster";
			data.address = data.room+"/"+data.pool;

			// decrease contextes socket level
			const sLevel = socket.context[data.address];
			if(sLevel) {
				if(sLevel.ref > 0) sLevel.ref--;
			}

			// decrease contextes global level
			const gLevel = self.context[data.address];
			if(gLevel) {
				if(gLevel.ref > 0) gLevel.ref--;
			}

			// brodcast information
			if(gLevel) self.emit("kernel/context/state", gLevel, {rooms: [data.room]})

			// real delete
			if(sLevel && sLevel.ref == 0) delete socket.context[data.address];
			if(gLevel && gLevel.ref == 0) delete self.context[data.address];
		});

		// when socket ends remove reference dependancy
		socket.on('end', () => {

			for(var address in socket.context) {
				const sLevel = socket.context[address];
				if(!sLevel) continue;
				const gLevel = self.context[address];
				if(!gLevel) continue;

				// substract
				gLevel.ref -= sLevel.ref;

				// brodcast information
				self.emit("kernel/context/state", gLevel, {rooms: [gLevel.room]})

				// real delete
				if(gLevel.ref <= 0) delete self.context[address];
			}
		});

		// give all registered context
		socket.on('worker/context/sync', () => {
			// Send all contexts
			for(var address in self.context) {
				const gLevel = self.context[address];
				self.emit("kernel/context/state", gLevel, {sockets: [socket.id]})
			}
		});

		// send seed to client
		// second argument is the address
		socket.type = "nodelink"
		socket.emit('play', socket.id)

		// Send current physical nodes
		for(var a in this.phyNodes) {
			socket.emit('node/add', this.phyNodes[a].id)
		}
		this.phyNodes[socket.id] = socket;
	}

	//
	//
	// Pre auth commands
	authCommands(socket) {
		const self = this;

		socket.on('type', function cmdType(type) {
			if(type=="nodelink") socket.removeListener('type', cmdType)
			self.nodeCommands(socket);
		});
	}

	//
	//
	// Pre auth commands
	preAuthCommands(socket) {
		const self = this;

		// get hmac authentitifcation
		socket.on('hmac', function cmdHash(hash) {
			if(hash !== socket.hmac) {
				debug("Connection authentification FAILED using "+hash);
				socket.destroy();
				return;
			}

			debug("Connection authentification SUCCESS using "+hash);

			socket.auth = true;

			// remove hmac
			socket.removeListener('hmac', cmdHash);

			self.authCommands(socket);
		})

		// generate a seed
		socket.seed = jen.password(32,32);

		// compute hmac in advance
		const hmac = crypto.createHmac('sha256', self.kernel.config.sharedKey);
		hmac.update(socket.seed);
		socket.hmac = hmac.digest('hex')

		debug("New connection ID "+socket.id+" with seed "+socket.seed);

		// send seed to client
		socket.emit('seed', socket.seed)
	}

}


module.exports = gatejsRouter;
