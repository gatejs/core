const area = 'core:service';

const debug = require('debug')('gatejs:core:service');
const gatejs = require("../index");
const fs = require("fs");
const cluster = require("cluster");
const crypto = require("crypto");

const jen = require("node-jen")();

const gatejsUplink = require("./uplink");
const gatejsNodelink = require("./nodelink");
const gatejsRouter = require("./router");

const Server = require('@gatejs/cluster').Server;

class gatejsInterface {
	constructor(kernel, options) {
		this.kernel = kernel;
		this.options = options;
	}

	start(cb) {
		const self = this;

		// spawn default local server
		this.server = new Server({kernel: this.kernel, psk: this.kernel.config.sharedKey});
		this.server.interface = this;

		// listening
		if(this.options.port) {
			this.server.listen(this.options.port, this.options.address, () => {
				debug("Binding internal "+this.options.address+":"+this.options.port);
				if(cb) cb();
			})
		}
		else {
			this.server.listen(this.options.address, () => {
				debug("Binding internal "+this.options.address);
				if(cb) cb();
			})
		}


	}
}

class gatejsService extends gatejs.kernel {
	constructor(config, cb) {

		super(config, () => {
			const self = this;
			const lib = this.lib;

			debug("Loading service");

			// check runonce
			this.runonce = new this.lib.runonce(this, "cluster");
			this.runonce.start();

			// prepare socket file
			const socketFile = this.config.runDir+'/cluster.sock';
			this.lib.utils.mkdirDeep(socketFile);

			// using local socket file
			try {
				fs.unlinkSync(socketFile);
			} catch(e) {}

			// create a @gatejs/cluster router
			this.router = new gatejsRouter(this, self.config.hostname);

			const sync = [
				// bind interface
				(next) => {
					// prepare all interface to bind
					self.node = new gatejsNodelink(self, {address: socketFile}) // connect on my own master process

					const toBind = [
						new gatejsInterface(self, {address: socketFile}),
					];

					// bind interfaces
					for(var a in this.config.interfaces) {
						toBind.push(new gatejsInterface(self, this.config.interfaces[a]));
					}

					// bind uplinks
					for(var a in this.config.uplinks) {
						toBind.push(new gatejsUplink(self, this.config.uplinks[a]));
					}

					// do bind
					function doBind(cb) {
						const cluster = toBind.shift();
						if(!cluster) {
							if(cb) cb();
							return;
						}

						cluster.start(() => {
							var address = cluster.options.address;
							if(cluster.options.port) address += ":"+cluster.options.port;

							// add server interface
							if(cluster instanceof gatejsInterface) {
								lib.log.system(area, "Binding Server interface at "+address);
								self.router.addServer(cluster.server, "node")
							}
							else if(cluster instanceof gatejsUplink) {
								lib.log.system(area, "Binding uplink link interface at "+address);
								self.router.addUplink(cluster.socket, "uplink")
							}
							// next binding
							process.nextTick(doBind, cb)
						})
					}

					doBind(next)
				},

				// start node interconnector
				(next) => {
					self.node.start(() => {
						this.node.on("room/register", (data) => {
							self.emit(data.room, data)
						})

						this.node.on("room/unregister", (data) => {
							self.emit(data.room, data)
						})

						next()
					})
				},

				// load workers
				(next) => {
					debug("Load service worker")
					self.stopped = false;
					self.spawned = 0;
					self.slaves = {};
					self.queue = [];

					// setup cluster events
					cluster.on('online', (worker) => {

						// wait for ready message
						// assign task
						worker.on('message', (message) => {
							if(message.cmd != "ready") return;

							// find task to assign
							const queue = self.queue.shift();
							if(!queue) {
								lib.log.system(area, "No queue to assign on worker");
								return;
							}

							// assign queue to worker
							worker.queue = queue;
							worker.queue.ready++;

							// start context
							worker.send({
								cmd: "assign",
								pool: queue.pool,
								name: queue.name,
								file: queue.file,
								scope: queue.scope
							});
						})

						self.slaves[worker.process.pid] = worker;
						debug("Worker process started #"+worker.process.pid);
					});

					cluster.on('exit', (worker, code, signal) => {
						if(self.stopped === true) {
							self.spawned--;
							debug("Normal exit for software stopping");

							if(self.spawned <= 0) {
								process.exit(0);
							}
							return;
						}

						// remove slave IPC
						delete self.slaves[worker.process.pid];

						// retry worker queue
						worker.queue.ready--;
						self.queue.push(worker.queue);

						lib.log.system(`worker ${worker.process.pid} died (${code}). restarting in 1sec...`);

						cluster.fork();
					});

					cluster.on('disconnect', (worker) => {
						lib.log.system(`Worker #${worker.id} - ${worker.process.pid} has disconnected`);
					});

					// run fork
					for(var a in self.workers) {
						const worker = self.workers[a];
						for(var b=0; b<worker.core; b++) {
							self.queue.push(worker);
							cluster.fork();
						}
					}

					next();
				},

			]

			lib.log.system(area, "Running Gatejs Cluster version "+lib.kernel.version)

			this.lib.utils.sync(sync, () => {
				self.emit("service/ready")
				self.emit("ready")
				if(cb) cb()
			})
		})
	}

	registerWorker(options) {
		if(!this.workers) this.workers = {}
		options.scope = options.scope || "machine";
		options.core = options.core || 1;
		options.ready = 0;
		this.workers[options.name] = options;
		debug("Loading "+options.core+" worker "+options.name+": "+options.file);
	}
}

module.exports = gatejsService;
