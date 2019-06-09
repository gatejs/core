const fs = require("fs");
const readline = require('readline');
const util = require("util");
const cluster = require('cluster');
const jen = require("node-jen")();
const debug = require('debug')('gatejs:test');


class gatejsTest {
	constructor(kernel, cb) {
		const self = this;

		this.kernel = kernel;

		cb();
		return;

	}

}


module.exports = gatejsTest;
