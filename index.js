const area = "core:kernel";

const fs = require('fs');
const cluster = require('cluster');
const child_process = require('child_process');
const os = require('os');
const debug = require('debug')('gatejs:core');
const path = require("path");
const EventEmitter = require('events').EventEmitter;
const jen = new (require('node-jen'))(true);

const gatejsRunonce = require('./lib/runonce');
const gatejsHosts = require("./lib/hosts");
const gatejsLogger = require("./lib/logger");
const gatejsPasswd = require("./lib/passwd");
const gatejsUtils = require("./lib/utils");
const gatejsPlugins = require("./lib/plugins");
const gatejsNreg = require("./lib/nreg");
const gatejsOpcodes = require("./lib/opcodes");
const gatejsPipeline = require("./lib/pipeline");
const gatejsIsolate = require("./lib/isolate");
const gatejsContext = require("./lib/context");

const pack = require("./package.json");

if (!('toJSON' in Error.prototype)) {
	Object.defineProperty(Error.prototype, 'toJSON', {
		value: function () {
			var alt = {};

			Object.getOwnPropertyNames(this).forEach(function (key) {
				alt[key] = this[key];
			}, this);

			return alt;
		},
		configurable: true,
		writable: true
	});
}

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};

String.prototype.safePath = function() {
	var s = this.toString().split("/"), r = [];
	for(var a in s) {
		if(s[a] != "..")
			r.push(s[a]);
	}
	r = r.join("/");
	var i = r.indexOf("\0");
	if(i > 0)
		r = r.substr(0, i);
	return(r);
};

String.dirname = (function(path) {
	return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
});

String.prototype.safe = function() {
	var s = this.toString().split("/"), r = [];
	for(var a in s) {
		if(s[a] != "..")
			r.push(s[a]);
	}
	r = r.join("/");
	var i = r.indexOf("\0");
	if(i > 0)
		r = r.substr(0, i);
	return(r);
};


class gatejsKernel extends EventEmitter {
	constructor(conf, cb) {
		super()

		const self = this;
		this.plugins = {};
		this.context = "gatejs";

		// load configuration file
		debug("Loading configuration from file "+conf);
		this.confFile = path.resolve(conf);
		this.loadConfiguration();

		// check sharedKey
		if(!this.config.sharedKey) {
			this.config.sharedKey = jen.password(128);
			debug("No shared key defined setting to "+this.config.sharedKey);
		}

		// initialise lib
		this.lib = {}

		// initialise basic libs
		this.registerLibrary('kernel', pack, "Kernel package");
		this.registerLibrary('utils', gatejsUtils, "Utility functions");
		this.registerLibrary('runonce', gatejsRunonce, "Verify program run once");
		this.registerLibrary('context', new gatejsContext(this), "Manage cluster context messaging");

		// log basic stuff
		this.loadPlugin(__dirname+"/plugins/log");

		// follow plugin Configuration
		for(var a in this.config.plugins) {
			const p = this.config.plugins[a];
			this.loadPlugin(p);
		}

		// load plugins
		const pk = Object.keys(this.plugins)

		function doPluginLoad(cb) {
			const k = pk.shift();
			if(!k) {
				cb();
				return;
			}
			const p = self.plugins[k];
			debug("Booting "+p.package.name+" v"+p.package.version);
			p.module(self, () => {
				process.nextTick(doPluginLoad, cb)
			})

		}

		doPluginLoad(() => {
			debug("Plugins loaded");
			cb();
		});

/*
		// load libs
		self.lib.hosts = new gatejsHosts(self);
		self.lib.ipaddr = gatejsIpaddr;
		self.lib.utils = gatejsUtils;
		self.lib.logger = new gatejsLogger(self);
		self.lib.nreg = gatejsNreg;
		self.lib.opcodes = gatejsOpcodes;
		self.lib.pipeline = gatejsPipeline;
	*/

	}

	registerIsolate(name, file) {}
	registerWorker() {}

	registerLibrary(name, context) {
		debug("Registering library "+name);
		this.lib[name] = context;
	}


	loadConfiguration() {
		// load configuration file
		try {
			var fss = fs.statSync(this.confFile);
			var req = require(this.confFile);
			this.config = req(this);
		} catch(e) {
			console.log("Could not open configuration file "+this.confFile+": "+e.message);
			process.exit(-1);
		}
	}


	loadPlugin(dir) {
		const self = this;
		const plugin = {}

		// load package
		try {
			plugin.package = require(dir+"/package.json");
		} catch(e) {
			console.log("Can not load plugin at "+dir+": error in package.json "+e.message);
			return;
		}

		// load module
		try {
			plugin.module = require(dir+"/index.js");
		} catch(e) {
			console.log("Can not load plugin at "+dir+": error in index.js "+e.message);
			return;
		}

		debug("Loading "+plugin.package.name+" v"+plugin.package.version+" from "+dir);

		this.plugins[plugin.package.name] = plugin;

		return(plugin)
	}

}

module.exports = {
	version: pack.version,
	kernel: gatejsKernel,
	passwd: gatejsPasswd,
	runonce: gatejsRunonce,
	logger: gatejsLogger,
	isolate: gatejsIsolate,
	utils: gatejsUtils
}
