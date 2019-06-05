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
	constructor(worker) {
		const self = this;
		const federal = worker.lib.federal;

		this.worker = worker;
		this.onlineFiles = {};
		this.rooms = ["log", this.worker.config.hostname+"/log"];

		// only federal server can really log events in files
		if(federal.serve === true) {
			// add federal actions
			federal.join(this.worker.config.hostname+"/log");

			// place log rotation
			function doReload() {
				for(var a in self.onlineFiles) {
					self.closeStream(a);
				}
				self.system("Log rotation completed");
			}

			federal.on('log/rotate', doReload);
			process.on('SIGUSR2', doReload);

			// receive log from nodejs IPC
			federal.on('log/packet', (worker, data) => {
				self.receiver(data);
			})
		}
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
		this.worker.lib.utils.mkdirDeep(filename);

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

			if(self.worker.daemon !== true) {
				//console.log(JSON.stringify(line));
			}

			if(ptr.timeout)
				clearTimeout(ptr.timeout);
			ptr.timeout = setTimeout(doClose, 30000);
		}

		return(ptr);
	}

	selectStream(site, type) {
		if(!this.worker.config.logDir)
			return(false);

		var filename;
		if(site)
			filename = this.worker.config.logDir+'/'+site+'.'+type+'.log';
		else
			filename  = this.worker.config.logDir+'/'+type+'.log';

		// create
		return(this.getStream(filename));
	}

	receiver(data) {
		var stream = this.selectStream(null, data.index);
		var hn = this.worker.config.hostname ? this.worker.config.hostname : null;
		data.host = hn;
		delete data.cid;
		stream.write(data);
	}

	send(packet) {
		// inform federation
		const federal = this.worker.lib.federal;

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


		// dispatch
		if(federal.serve === true) this.receiver(packet);
		else { federal.send('log/packet', packet, {rooms: this.rooms});}
	}

	system(data) {
		var packet = {
			date: new Date,
			process: process.pid,
			index: 'pjs-system',
			data: data
		};
		this.send(packet)
	}

	error(data) {
		var packet = {
			date: new Date,
			process: process.pid,
			index: 'pjs-error',
			data: data
		};
		this.send(packet)
	}
}


module.exports = gatejsLogger;
