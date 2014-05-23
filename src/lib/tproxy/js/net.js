/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy net module patch code [http://www.binarysec.com]
 * 
 * This file is part of Gate.js.
 * 
 * Gate.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.	If not, see <http://www.gnu.org/licenses/>.
 */

var nodeNet = require('net');
var tproxy = require('../build/Release/obj.target/tproxy.node');

var net = function() { /* loader below */ };


var debug;
if(process.env.NODE_DEBUG && /net/.test(process.env.NODE_DEBUG)) {
	var pid = process.pid;
	debug = function(x) {
		// if console is not set up yet, then skip this.
		if(!console.error)
			return;
		console.error('NET: %d', pid, util.format.apply(util, arguments).slice(0, 500));
	};
} else {
	debug = function() { };
}

function toNumber(x) { return (x = Number(x)) >= 0 ? x : false; }

function isPipeName(s) {
	return typeof s === 'string' && toNumber(s) === false;
}

function createTCP() {
	var TCP = process.binding('tcp_wrap').TCP;
	return new TCP();
}

function createTproxyServerHandle(address, port, addressType, fd) {
	var r = 0;
	// assign handle in listen, and clean up if bind or listen fails
	var handle;
//console.log("DEBUG: createTproxyServerHandle", arguments);
	if(typeof(addressType) !== 'object')
		return(nodeNet.__previousCreateServerHandle(address, port, addressType, fd));
	if(!addressType.hasOwnProperty('mode') || !addressType.hasOwnProperty('type'))
		return(nodeNet.__previousCreateServerHandle(address, port, addressType, fd));
	if(addressType.mode == 'tproxy')
		addressType = addressType.type;
	
	if(typeof fd === 'number' && fd >= 0) {
		try {
			handle = createHandle(fd);
		} catch (e) {
			// Not a fd we can listen on.	This will trigger an error.
			debug('listen invalid fd=' + fd + ': ' + e.message);
			process._errno = 'EINVAL'; // hack, callers expect that errno is set
			return null;
		}
		handle.open(fd);
		handle.readable = true;
		handle.writable = true;
		return handle;
	
	}
	else if(port == -1 && addressType == -1) {
		handle = createPipe();
		if(process.platform === 'win32') {
			var instances = parseInt(process.env.NODE_PENDING_PIPE_INSTANCES);
			if(!isNaN(instances)) {
				handle.setPendingInstances(instances);
			}
		}
	}
	else {
		handle = createTCP();
	}
	
	if(address || port) {
		debug('bind to ' + address);
		fd = httpTproxy.newTproxyFD(addressType);
		handle.open(fd);
		if(addressType == 6) {
			r = handle.bind6(address, port);
		} else {
			r = handle.bind(address, port);
		}
	}
	
	if(r) {
		handle.close();
		handle = null;
	}
	
	return handle;
};

nodeNet._createTproxyServerHandle = createTproxyServerHandle;

nodeNet.__previousCreateServerHandle = nodeNet._createServerHandle;
nodeNet._createServerHandle = createTproxyServerHandle;

function onconnection(clientHandle) {
	var handle = this;
	var self = handle.owner;
	
	debug('onconnection');
	
	if(!clientHandle) {
		self.emit('error', errnoException(process._errno, 'accept'));
		return;
	}
	
	if(self.maxConnections && self._connections >= self.maxConnections) {
		clientHandle.close();
		return;
	}
	
	var socket = new nodeNet.Socket({
		handle: clientHandle,
		allowHalfOpen: self.allowHalfOpen
	});
	socket.readable = socket.writable = true;
	
	
	self._connections++;
	socket.server = self;
	
	//DTRACE_NET_SERVER_CONNECTION(socket);
	//COUNTER_NET_SERVER_CONNECTION(socket);
	self.emit('connection', socket);
}

nodeNet.Server.prototype._listenTproxy2 = function(address, port, addressType, backlog, fd) {
	debug('listen2', address, port, addressType, backlog);
	var self = this;
	var r = 0;
//console.log("DEBUG: _listenTproxy2", arguments);
	// If there is not yet a handle, we need to create one and bind.
	// In the case of a server sent via IPC, we don't need to do this.
	if(!self._handle) {
		debug('_listenTproxy2: create a handle');
		self._handle = createTproxyServerHandle(address, port, addressType, fd);
		if(!self._handle) {
			var error = errnoException(process._errno, 'listen');
			process.nextTick(function() {
				self.emit('error', error);
			});
			return;
		}
	}
	else {
		debug('_listenTproxy: have a handle already');
	}
	
	self._handle.onconnection = onconnection;
	self._handle.owner = self;
	
	// Use a backlog of 512 entries. We pass 511 to the listen() call because
	// the kernel does: backlogsize = roundup_pow_of_two(backlogsize + 1);
	// which will thus give us a backlog of 512 entries.
	r = self._handle.listen(backlog || 511);
	
	if(r) {
		var ex = errnoException(process._errno, 'listen');
		self._handle.close();
		self._handle = null;
		process.nextTick(function() {
			self.emit('error', ex);
		});
		return;
	}
	
	// generate connection key, this should be unique to the connection
	this._connectionKey = addressType + ':' + address + ':' + port;
	
	process.nextTick(function() {
		self.emit('listening');
	});
};

function listenTproxy(self, address, port, addressType, backlog, fd) {
	if(!cluster) cluster = require('cluster');
	
//addressType = {mode: 'tproxy', type: addressType};
	
	if(cluster.isMaster) {
		self._listenTproxy2(address, port, addressType, backlog, fd);
		return;
	}
	
	cluster._getServer(self, address, port, addressType, fd, function(handle, err) {
		// EACCESS and friends
		if(err) {
			self.emit('error', errnoException(err, 'bind'));
			return;
		}
		
		// Some operating systems (notably OS X and Solaris) don't report
		// EADDRINUSE errors right away. libuv mimics that behavior for the
		// sake of platform consistency but that means we have have a socket on
		// our hands that is not actually bound. That's why we check if the
		// actual port matches what we requested and if not, raise an error.
		// The exception is when port == 0 because that means "any random
		// port".
		if(port && handle.getsockname && port != handle.getsockname().port) {
			self.emit('error', errnoException('EADDRINUSE', 'bind'));
			return;
		}
		
		httpTproxy.setTproxyFD(handle.fd);
		self._handle = handle;
		self._listenTproxy2(address, port, addressType, backlog, fd);
	});
}

nodeNet.Server.prototype.listenTproxy = function() {
	var self = this;
	
	var lastArg = arguments[arguments.length - 1];
	if(typeof lastArg == 'function') {
		self.once('listening', lastArg);
	}
	
	var port = toNumber(arguments[0]);
	
	// The third optional argument is the backlog size.
	// When the ip is omitted it can be the second argument.
	var backlog = toNumber(arguments[1]) || toNumber(arguments[2]);
	
	var TCP = process.binding('tcp_wrap').TCP;
//console.log("DEBUG: listenTproxy", arguments);
	if(arguments.length == 0 || typeof arguments[0] == 'function') {
		// Bind to a random port.
		listenTproxy(self, '0.0.0.0', 0, null, backlog);
	}
	else if(arguments[0] && typeof arguments[0] === 'object') {
		var h = arguments[0];
		if(h._handle) {
			h = h._handle;
		} else if(h.handle) {
			h = h.handle;
		}
		if(h instanceof TCP) {
			self._handle = h;
			listenTproxy(self, null, -1, -1, backlog);
		} else if(typeof h.fd === 'number' && h.fd >= 0) {
			listenTproxy(self, null, null, null, backlog, h.fd);
		} else {
			throw new Error('Invalid listen argument: ' + h);
		}
	}
	else if(isPipeName(arguments[0])) {
		// UNIX socket or Windows pipe.
		var pipeName = self._pipeName = arguments[0];
		listenTproxy(self, pipeName, -1, -1, backlog);
	}
	else if(typeof arguments[1] == 'undefined' ||
				typeof arguments[1] == 'function' ||
				typeof arguments[1] == 'number') {
		// The first argument is the port, no IP given.
		listenTproxy(self, '0.0.0.0', port, 4, backlog);
	}
	else {
		// The first argument is the port, the second an IP.
		require('dns').lookup(arguments[1], function(err, ip, addressType) {
			if(err) {
				self.emit('error', err);
			} else {
				listenTproxy(self, ip || '0.0.0.0', port, ip ? addressType : 4, backlog);
			}
		});
	}
	return self;
};


net.loader = function(gjs) { }

module.exports = net;
