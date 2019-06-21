const debug = require('debug')('gatejs:core:service');
const gatejs = require("../index");
const Server = require('@gatejs/cluster').Server;
const Socket = require('@gatejs/cluster').Socket;
const fs = require("fs");
const cluster = require("cluster");

const gService = require("./service");
const gWorker = require("./worker");
const gUplink = require("./uplink");
const gNodelink = require("./nodelink");

module.exports = {
	boot: gService,
	service: gService,
	worker: gWorker,
	uplink: gUplink,
	nodelink: gNodelink
}

if(!cluster.isMaster) module.exports.boot = gWorker;
