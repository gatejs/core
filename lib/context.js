const fs = require('fs');
const debug = require('debug')('gatejs:context');

class gatejsContext {
	constructor(kernel) {
		const self = this;
		
		this.kernel = kernel;
		this.context = {};
		this.pools = {}

		this.init = false;

	}

	on(pool, cb) {
		if(!this.pools[pool]) {
			this.pools[pool] = []
			this.kernel.on("room/"+pool, (data) => {
				this.emit(pool, data)
			})
		}

		this.pools[pool].push(cb);
	}

	emit(pool, args) {
		if(!this.pools[pool]) return;
		const p = this.pools[pool];
		for(var a=0; a<p.length; a++) p[a](args)
	}

	activate(pool) {
		// inform cluster that new kernel register
		// then increase reference on a kernel
		this.kernel.node.join("room/"+pool)
	}

	deactivate(pool) {
		// inform cluster that new kernel register
		// then increase reference on a kernel
		this.kernel.node.leave("room/"+pool)
	}
}


module.exports = gatejsContext;
