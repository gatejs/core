const debug = require('debug')('gatejs:opcodes');
const fs = require('fs');

class gatejsOpcodes {
	constructor(worker) {
		this.worker = worker;
		this.opcodes = {};
	}

	scan(scanDir) {
		const lib = this.worker.lib;

		debug("Scanning from "+scanDir);

		try {
			var d = fs.readdirSync(scanDir), a;
		} catch(e) {
			lib.logger.error({type: 'opcode', reason: "Error scanning directory "+scanDir+": "+e.message, catch: e.toJSON()});
		}

		for(var a in d) {
			if(d[a].search(/\.js$/) > 0) {
				var m = d[a].match(/(.*)\.js$/);
				var f = scanDir + '/' + m[1];
				if(!this.opcodes[m[1]]) {

					try {
						this.opcodes[m[1]] = require(f);
					} catch(e) {
						lib.logger.error({type: 'opcode', reason: "Error loading "+d[a]+": "+e.message, catch: e.toJSON()});
					}

					if(!this.opcodes[m[1]]) {
						debug("Error Loading "+m[1]+" from "+f);
						continue;
					}

					if(this.opcodes[m[1]].ctor)
						this.opcodes[m[1]].ctor(this.worker);
					debug("Loading "+m[1]+" from "+f);
				}
			}
		}

	}

	get(name) {
		return(this.opcodes[name]);
	}
}

module.exports = gatejsOpcodes;
