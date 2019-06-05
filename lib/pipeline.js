const debug = require('debug')('gatejs:pipeline');
const jen = require("node-jen")();
const fs = require('fs');

const reduxDate = new Date("2019-01-01").getTime();

class gatejsPipelineVector {
	constructor(errorCb) {
		this.errorCb = errorCb;

		this.states = {
			execute: 0,
			waiting: 1,
			stop: 2
		};

		this.destroying = false;
		this.selector = "request";

		this.streams = {
			first: null,
			dupFirst: [],
			filters: [],
			last: null,
			dupLast: [],
			bytes: 0
		}

		this.log = {}

		// build pipeline vector ID
		var id = "";
		id += (Date.now()-reduxDate).toString(16);
		id += '-'+jen.random(2).toString(16);
		this.id = id;
		this.log.vector = id;

		// setup starting time
		this.startTime = Date.now();

		debug(this.id+" Creating Pipeline Vector");
	}

	streamDuplicateEmitter(stream) {
		this.streams.dupFirst.push(stream);
	}

	streamEmitter(stream) {
		if(this.streams.first !== null) {
			debug(this.id+" Emitter stream exists, replacing stream="+steam.name);
		}
		this.streams.first = stream;
	}

	streamFilter(stream) {
		this.streams.filters.push(stream);
	}

	streamReceiver(stream) {
		if(this.streams.last !== null) {
			debug(this.id+" Receiver stream exists, replacing stream="+steam.name);
		}
		this.streams.last = stream;
	}

	streamDuplicateReceiver(stream) {
		this.streams.dupLast.push(stream);
	}

	streaming() {
		const self = this;
		debug(this.id+" Streaming Emitter stream="+this.streams.first.name);
		var under = this.streams.first;

		// duplicate first
		for(var a=0; a<this.streams.dupFirst.length; a++) {
			const p = this.streams.dupFirst[a];
			debug(this.id+" Streaming duplicate Emitter stream="+p.name);
			under.pipe(p);
		}

		// follow filters from emitter to receiver
		for(var a=0; a<this.streams.filters.length; a++) {
			const p = this.streams.filters[a];
			debug(this.id+" Streaming Filter stream="+p.name);
			under = under.pipe(p);
		}

		// pipe duplicate receiver to the last or first pipe
		for(var a=0; a<this.streams.dupLast.length; a++) {
			const p = this.streams.dupLast[a];
			debug(this.id+" Streaming duplicate Receiver stream="+p.name);
			under.pipe(p);
		}

		debug(this.id+" Streaming Receiver stream="+this.streams.last.name);

		// count byte transiting
		under.on('data', (d) => {
			self.streams.bytes += d.length;
		})

		// terminate to the last one
		under.pipe(this.streams.last);
	}

	setLine(line) {
		this.pipe = line;
	}

	stop() {
		// stop execution
		this.status = this.states.stop;

		// setup starting time
		this.stopTime = Date.now();
	}

	pause() {
		// wait for non blocking operation
		this.status = this.states.waiting;
	}

	resume() {
		// continue to execute pipeline
		this.status = this.states.execute;
	}

	destroy() {
		this.destroying = true;
		this.status = this.states.stop;
	}

	execute() {
		const self = this;

		var index = 0;

		// execute pipeline
		function next() {
			if(self.destroying === true)
				return;

			if(self.status != self.states.execute)
				return;

			var func = self.pipe.production[index];

			if(func === undefined) {
				self.errorCb("Pipeline terminated without controler");
				return;
			}
			var name = self.pipe.line[index][0];
			index++;

/*
			// sync version
			var arg = [self, next];
*/
			// async version
			var arg = [self, () => {
				process.nextTick(next);
			}];

			var cb = func[0];

			// check error
			if(!cb) {
				self.errorCb("Pipeline terminated without executor");
				return;
			}

			// build arg
			for(var a=1; a<func.length; a++)
				arg.push(func[a]);

			//debug("Executing "+name);

			// execute callback selector
			const exec = cb[self.selector];
			if(exec) {
				cb[self.selector].apply(null, arg);
			}
			else {
				process.nextTick(next);
			}
		}

		next();
	}
}

class gatejsPipeline {
	constructor(name, opcodes, line) {
		this.opcodes = opcodes;
		this.line = line;

		// get lib from opcode
		const lib = opcodes.worker.lib;

		// production line
		this.production = [];

		// optimize pipeline
		for(var a=0; a<line.length; a++) {
			var p = line[a];
			//console.log(p[0]);
			var op = opcodes.get(p[0]);
			if(!op) {
				lib.logger.error({type: 'pipeline', name: name, reason: 'Can not find opcode called '+p[0]});
			}
			else {
				//console.log(p)
				var n = [];

				n[0] = op;
				for(var b=1; b<p.length; b++) {
					n.push(p[b]);
				}
				this.production.push(n);
			}
		}
	}

}


module.exports = {
	root: gatejsPipeline,
	vector: gatejsPipelineVector
};
