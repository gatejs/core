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

class gatejsLogger {
	constructor(kernel, cb) {
		const self = this;

		this.kernel = kernel;
		this.rooms = ["log", this.kernel.config.hostname+"/log"];

		// place log rotation
		function doReload() {
			for(var a in self.onlineFiles) {
				self.closeStream(a);
			}
			self.system("Log rotation completed");
		}

		kernel.node.on('log/reload', doReload);
		process.on('SIGUSR2', doReload);

		// receive log packets
		kernel.node.on('log/packet', (data) => {
			self.receiver(data);
		})

		kernel.lib.context.activate(this.rooms[1]);

		cb();
	}

	closeStream(filename) {
		var ptr = this.onlineFiles[filename]
		if(!ptr)
			return;

		ptr.stream.close();
		delete this.onlineFiles[filename];

		debug("Closing file "+filename)
	}

	getStream(filename) {
		const self = this;
		var ptr;

		if(!this.onlineFiles)
			this.onlineFiles = {};

		if(this.onlineFiles[filename])
			return(this.onlineFiles[filename]);

		/* create dirs if necessary */
		this.kernel.lib.utils.mkdirDeep(filename);

		/* open the stream */
		ptr = this.onlineFiles[filename] = {
			file: filename,
			stream: fs.createWriteStream(filename, { flags: 'a' })
		};

		debug("Openning file "+filename);

		function doClose() {
			self.closeStream(filename);
		}
		ptr.timeout = setTimeout(doClose, 30000);

		ptr.stream.on('error', function(err) {
			console.log('Error openning log file '+err.path+' with code #'+err.code);
		});

		ptr.write = function(line) {
			ptr.stream.write(JSON.stringify(line)+'\n');

			if(self.kernel.daemon !== true) {
				//console.log(JSON.stringify(line));
			}

			if(ptr.timeout)
				clearTimeout(ptr.timeout);
			ptr.timeout = setTimeout(doClose, 30000);
		}

		return(ptr);
	}

	selectStream(site, type) {
		if(!this.kernel.config.logDir)
			return(false);

		var filename;
		if(site)
			filename = this.kernel.config.logDir+'/'+site+'.'+type+'.log';
		else
			filename  = this.kernel.config.logDir+'/'+type+'.log';

		// create
		return(this.getStream(filename));
	}

	receiver(data) {
		var stream = this.selectStream(null, data.index);
		var hn = this.kernel.config.hostname ? this.kernel.config.hostname : null;
		data.host = hn;
		delete data.cid;
		stream.write(data);
	}

}


module.exports = gatejsLogger;
