var url = require("url");

var debian = function(bs) { /* */ }

debian.request = function(bs) {
	
	var m = bs.request.urlParseCacheStore.host.match(/.*\.ubuntu\.com$/);
	if(m && bs.request.urlParseCacheStore.path.match(/.*\.(deb)$/)) {
		var p = bs.request.urlParseCacheStore;
		p.hostname =
		p.host = 'ubuntu.com';
		delete p.search;
		return(true);
	}
	
	
	var m = bs.request.urlParseCacheStore.host.match(/.*\.debian\.org$/);
	if(m && bs.request.urlParseCacheStore.path.match(/.*\.(deb)$/)) {
		var p = bs.request.urlParseCacheStore;
		p.hostname =
		p.host = 'debian.org';
		delete p.search;
		console.log(p);
		return(true);
	}
	
	return(false);
}

module.exports = debian; 
