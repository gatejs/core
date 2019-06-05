
const cluster = require("cluster");
const fs = require("fs");
const os = require("os");

class gatejsHosts {
	constructor(worker) {
		this.worker = worker;
		this.name = {}

		const self = this;

		// detect file
		if(	self.worker.config.hostsFile &&
			fs.existsSync(self.worker.config.hostsFile)
			) {
				self.file = self.worker.config.hostsFile;
		}
		else if(os.platform() == "linux")
			self.file = "/etc/hosts";
		else if(os.platform() == "windows")
			self.file = "C:\Windows\System32\drivers\etc\hosts";
		else
			self.file = "/etc/hosts";


		// watch file change
		fs.watchFile(self.file, function(curr, prev) {
			if(curr.mtime != prev.mtime) {
				self.refresh();
			}
		});
	}

	refresh() {
		const self = this;

		try {
			// read file to string, replace \t to ' ' and split lines
			var lines = fs.readFileSync(self.file).toString().replace(/[\t ]+/g, " ").split('\n');
			for(var i in lines) {
				// if not empty and not comment
				if(lines[i].length && lines[i][0] != '#') {
					// split line and retrieve ip
					var l = lines[i].split(' ');
					var ip = l.shift();

					// merge or add results
					self.name[ip] = self.name[ip] ? self.name[ip].concat(l) : l;
				}
			}
		}
		catch(e) {
			return;
		}

	}

	resolve(host) {
		for(var i in self.name) {
			if(self.name[i].indexOf(host) > -1) {
				return i;
			}
		}
		return false;
	};

	reverse(ip) {
		return self.name[ip] ? self.name[ip] : false;
	};
}




module.exports = gatejsHosts;
