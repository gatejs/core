const area = 'core:worker';

const debug = require('debug')('gatejs:core:worker');
const gatejs = require("../index");
const Socket = require('@gatejs/cluster').Socket;
const fs = require("fs");

const gatejsNodelink = require("./nodelink");

class gatejsWorker extends gatejs.kernel {
	constructor(config, cb) {
		super(config, () => {
			const self = this;
			const lib = this.lib;

			debug("Loading Worker process #"+process.pid);


			// prepare socket file
			const socketFile = this.config.runDir+'/cluster.sock';

			// prepare all interface to bind
			this.node = new gatejsNodelink(this, {
				address: socketFile
			});

			var init = false;

			this.node.start(() => {
				self.node.on("room/register", (data) => {
					self.emit(data.room, data)
				})

				self.node.on("room/unregister", (data) => {
					self.emit(data.room, data)
				})

				this.node.on('play', () => {
					// worker is ready
					self.emit("worker/ready")
					self.emit("ready")

					if(init === true) return;

					// this a little moment berfore to fully complet worker init
					process.on('message', (message) => {
						if(message.cmd != "assign") return;
						process.title = message.name;

						// load script
						try {
							const obj = require(message.file);
							self.application = new obj(self, cb);
						} catch(e) {
							self.lib.log.error("Can not load worker "+message.name+" > "+message.file+": "+e.message);
							console.log(e);
							console.trace()
							setTimeout(() => {
								process.exit(-1);
							}, 2000)
							return;
						}

						lib.log.system(area, "Worker process spawned #"+process.pid+": "+message.name);
					})
					process.send({cmd: 'ready'});
					init = true;
				})
			})
		})
	}

}

module.exports = gatejsWorker;
