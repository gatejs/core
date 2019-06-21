const fs = require("fs");
const readline = require('readline');
const util = require("util");
const cluster = require('cluster');
const jen = require("node-jen")();
const debug = require('debug')('gatejs:logger');

const reduxDate = new Date("2019-01-01").getTime();

function fixZero(d) {
	if(d < 10) return("0"+d)
	return(""+d);
}
//context/machine/host1/log
class gatejsLogger {
	constructor(kernel) {
		const self = this;

		this.kernel = kernel;
		this.onlineFiles = {};
		this.rooms = ["log", this.kernel.config.hostname+"/log"];
		this.ready = false;
		this.buffer = [];

		this.states = {}

		function activer(data) {
			if(!self.states[data.room]) self.states[data.room] = data;

			var state = self.states[data.room];
			if(data.ref <= 0) state.ready = false;
			else state.ready = true;

			// find a leat one room ready
			var leastReady = false;
			for(var a in self.states) {
				var p = self.states[a];
				if(p.ready === true) {
					leastReady = true;
					break;
				}
			}

			if(self.ready === false && leastReady === true) {
				debug('library is ready with '+self.buffer.length+" logs pending")

				// send pending logs
				for(var a=0; a<self.buffer.length; a++) {
					const log = self.buffer[a];
					kernel.node.emit("log/packet", log, {rooms: self.rooms})
				}

				// reset logs
				self.buffer = [];

				// log is ready
				self.ready = true;
			}

		}

		kernel.lib.context.on(this.rooms[0], activer)
		kernel.lib.context.on(this.rooms[1], activer)
	}

	send(packet) {
		// inform federation
		const federal = this.kernel.lib.federal;

		// build pipeline vector ID
		var id = "";
		id += (Date.now()-reduxDate).toString(16);
		id += '-'+jen.random(2).toString(16);
		packet.id = id;

		// setup index
		const now = new Date;
		packet.index += "-"+now.getFullYear()+
			fixZero(now.getMonth())+
			fixZero(now.getDate());

		if(this.ready === false) this.buffer.push(packet)
		else this.kernel.node.emit("log/packet", packet, {rooms: this.rooms})
	}

	system(area, message) {
		var packet = {
			date: new Date,
			process: process.pid,
			index: 'gjs-system',
			area: area,
			message: message
		};
		console.log(packet.date, "system", area, message);
		this.send(packet)
	}

	error(area, message) {
		var packet = {
			date: new Date,
			process: process.pid,
			index: 'gjs-error',
			area: area,
			message: message
		};
		console.log(packet.date, "error", area, message);
		this.send(packet)
	}
}


module.exports = gatejsLogger;
