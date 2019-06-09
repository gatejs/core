const fs = require('fs');
const debug = require('debug')('gatejs:context');

class gatejsContext {
	constructor(kernel) {
		const self = this;

		this.kernel = kernel;
		this.context = {};
		this.pools = {}

		kernel.on("ready", () => {
			kernel.node.join("context/machine/"+this.kernel.config.hostname)
			kernel.node.join('context/cluster')

			// here we receive states from server router
			// if a context disconnect for any reason
			// this event will be triggered as well
			kernel.node.on('kernel/context/state', (state) => {
				// copy states
				self.context[state.address] = state;

				// emit checker
				self.emit(state.pool, state.ref)

				if(state.ref <= 0) delete self.context[state.address];

				debug(process.pid+" got state "+state.address+" reference="+state.ref);
			})

			kernel.node.emit("worker/context/sync");
		});
	}

	on(pool, cb) {
		if(!this.pools[pool]) this.pools[pool] = []
		this.pools[pool].push(cb);
	}

	emit(pool, args) {
		if(!this.pools[pool]) return;
		const p = this.pools[pool];
		for(var a=0; a<p.length; a++) p[a](args)
	}

	activate(pool, scope) {
		if(!scope) scope = "machine";
		scope = scope === "machine" ? "machine" : "cluster";

		// inform cluster that new kernel register
		// then increase reference on a kernel
		this.kernel.node.emit("worker/context/activate", {
			host: this.kernel.config.hostname,
			pool, pool,
			scope, scope
		});
	}

	deactivate(pool, scope) {
		if(!scope) scope = "machine";
		scope = scope === "machine" ? "machine" : "cluster";

		// inform cluster that new kernel register
		// then increase reference on a kernel
		this.kernel.node.emit("worker/context/deactivate", {
			host: this.kernel.config.hostname,
			pool, pool,
			scope, scope
		});
	}
}


module.exports = gatejsContext;
