
var net = require('net');

var tproxy = function() { /* loader below */ };

// var binding = require(__dirname+'/build/Release/tproxy.node');
try {
	tproxy.httpTproxy = require(__dirname+'/js/httpTproxy');
} catch(e) {
	console.log("* tproxy module exeption", e);
}
// tproxy.httpServer = require(__dirname+'/js/httpServer');
// tproxy.acn = require(__dirname+'/js/acn.js');

tproxy.loader = function(bs) {
	try {

	} catch(e) {

	}
}

module.exports = tproxy;
