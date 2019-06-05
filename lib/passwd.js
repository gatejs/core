const fs = require("fs");

function parseDoubleDot(dst, filename) {
	var lines = fs.readFileSync(filename).toString().split("\n");
	for(var a in lines) {
		var t = lines[a].split(':');
		if(t.length > 1)
			dst[t[0]] = t;
	}
}

class gatejsPasswd {
	constructor(worker) {
		this.worker = worker;

		this.usersByName = {}
		this.groupsByName = {}

		parseDoubleDot(this.usersByName, '/etc/passwd');
		parseDoubleDot(this.groupsByName, '/etc/group');
	}

	getUser(name) {
		if(this.usersByName[name])
			return(this.usersByName[name]);
		return(null);
	}

	getGroup(name) {
		if(this.groupsByName[name])
			return(this.groupsByName[name]);
		return(null);
	}

}


module.exports = gatejsPasswd;
