const fs = require('fs');
const debug = require('debug')('gatejs:plugins');

class gatejsPlugins {
	constructor(worker) {
		const self = this;

		this.worker = worker;
		this.items = {};

		worker.ipc.local.on('preStart', () => {
			self.scan(__dirname+"/builtin");

			// load third part
			if(worker.config.plugins) {
				debug("Loading third part plugins");
				for(var a in worker.config.plugins) {
					var file = worker.config.plugins[a];
					self.load(file+"/index.js")
				}
			}
		});

		// late plugin bindings
		worker.ipc.local.on('postStart', () => {
			debug("Late plugins binding");
			for(var a in self.items) {
				const p = self.items[a];
				if(p.bind) p.bind();
			}
		});
	}

	get(name) {
		return(this.items[name]);
	}

	load(file) {
		debug("Loading "+file);
		const lib = this.worker.lib;
		try {
			var fss = fs.statSync(file);

			var o = new (require(file))(this.worker);

			if(!o.getName) {
				lib.logger.error({type: 'plugins', reason: 'No name defined for plugin '+file});
				return(false);
			}
			var name = o.getName();

			if(this.items[name]) {
				lib.logger.error({type: 'plugins', name: name, reason: 'Plugin '+name+' already exists'});
				return(false);
			}
			this.items[name] = o;

		} catch(e) {
			lib.logger.error({type: 'plugins', name: name, reason: e.message, catch: e});
			console.log({type: 'plugins', name: name, file: file, reason: e.message, catch: e});
		}
	}

	scan(scandir) {
		const lib = this.worker.lib;

		debug("Scanning");

		//try {
			var dirs = fs.readdirSync(scandir);
			for(var a in dirs) {
				var dir = dirs[a];
				var path = `${scandir}/${dir}`;
				var fss = fs.statSync(path)

				if(fss.isDirectory()) {
					this.load(path+"/index.js");
				}
			}
			/*
		} catch(e) {
			lib.logger.error({type: 'plugins', reason: e.message});
		}
		*/
	}
}


module.exports = gatejsPlugins;
