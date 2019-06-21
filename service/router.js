const debug = require('debug')('gatejs:core:router');
const gatejs = require("../index");
const fs = require("fs");
const cluster = require("cluster");
const crypto = require("crypto");

const jen = require("node-jen")();

const Router = require('@gatejs/cluster').Router;

class gatejsRouter extends Router {
	constructor(kernel, hostname) {
		super(hostname);

		this.kernel = kernel;
		this.phyNodes = {}
		this.context = {}

		const self = this;

		// downlink
		this.on('downlink/add', function (socket) {
			socket.interface = socket._server.interface;
			self.nodeCommands(socket);

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


	//
	//
	// Node information
	nodeCommands(socket) {
		debug("Allocating address for socket "+socket.id);
		const self = this;

		// prepare socket
		socket.type = "nodelink"


		// when socket ends remove reference dependancy
		socket.on('end', () => {



		});

		// send the current room status
		for(var room in self.rooms) {
			// compute all counter
			var counter = 0;
			for(var a in this.rooms[room]) counter += this.rooms[room][a];
			socket.emit("room/register", {room: room, ref: counter});
		}

		// Send current physical nodes
		for(var a in this.phyNodes) {
			socket.emit('node/add', this.phyNodes[a].id)
		}
		this.phyNodes[socket.id] = socket;

		// send seed to client
		// second argument is the address
		socket.emit('play', socket.id)

/*
		// add backbone node
		this.kernel.backbone.addNode(
			socket.hostname,
			socket.id,
			socket.cost
		);
*/

	}

}


module.exports = gatejsRouter;
