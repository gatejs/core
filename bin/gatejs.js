#!/usr/bin/env node

const fs = require('fs');
const program = require('subcommander');
const debug = require('debug')('gatejs:cli');
const gatejs = require("../index");
const gatejsService = require("../service/index");

// common options
program
.option('config', {
	abbr: 'c',
	desc: 'Configuration file to use',
	default: '/etc/gatejs/config.js',
});

// start command
program.command('start', {
	desc: 'Start Gatejs Cluster Service',
	callback: function (options) {
		var app = new gatejsService.boot(options.config, () => {
			debug("Cluster is running");
		});

		//app.start();
	},
});

// load specific commands
const source = __dirname+'/commands';
try {
	var dirs = fs.readdirSync(source);
	for(var a in dirs) {
		var p = dirs[a];
		require(source+'/'+p);
	}
} catch(e) {}

// version command
program.command('version', {
	desc: 'Current version',
	callback: function () {
		console.log(' Gatejs - v' + gatejs.version + ' (c) 2019 - Michael Vergoz');
	},
});

program.parse();
