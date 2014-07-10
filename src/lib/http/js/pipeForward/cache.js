/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Forward cache opcode [http://www.binarysec.com]
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * Origin: Michael VERGOZ
 */

var util = require("util");
var http = require("http");
var url = require("url");
var fs = require("fs");
var crypto = require('crypto');
var cluster = require("cluster");

var cache = function(pipe) { }

cache.request = function(pipe, opts) {
	
	var tryToStream = function(input) {

		var inHash;
		if(pipe.request.urlParseCacheStore)
			inHash = url.format(pipe.request.urlParseCacheStore)+input;
		else
			inHash = pipe.request.headers.host+url.format(pipe.request.urlParse)+input;
		
		if(!opts.dirDiviser)
			opts.dirDiviser = 0;
		
		var hash = pipe.root.lib.acn.generateInHash(opts.dirDiviser, inHash);
		var headers = pipe.root.lib.acn.loadHeaderFile(hash.file);
		if(!headers)
			return(false);

		/* check if the file must be dumped */
		if(headers.needDump == false) {
			/* check stale */
			var isF = pipe.root.lib.acn.isFresh(headers);
			if(isF == false)
				return(false);

			/*
			 * Manage the 304 not stupuflux
			 */
			if(
				(pipe.request.headers['if-modified-since'] &&
				headers.headers['Last-Modified'] == pipe.request.headers['if-modified-since']) ||
				(pipe.request.headers['if-none-match'] &&
				headers.headers.etag == pipe.request.headers['if-none-match'])
				) {

				delete headers.headers['content-type'];
				delete headers.headers['last-modified'];
				delete headers.headers['content-encoding'];
				delete headers.headers['content-length'];

				pipe.root.lib.core.ipc.send('LFW', 'pipeStatus', {
					host: pipe.request.headers.host,
					hits: true
				});
				
				pipe.response.gjsCache = 'hit_rms';

				/* load headers */
				for(var n in headers.headers)
					pipe.response.gjsSetHeader(n, headers.headers[n]);
				
				pipe.response.emit("response", pipe.response, 'cache304');
				
				if(
					pipe.server.isClosing == true || 
					pipe.request.headers.connection == 'close' ||
					(pipe.request.httpVersion == '1.0' && !pipe.request.headers.connection)
					) {
					pipe.response.gjsSetHeader('Connection', 'Close');
					pipe.response.gjsRemoveHeader('keep-alive');
				}
				
				/* fix headers */
				var nHeaders = {};
				for(var n in pipe.response.headers)
					nHeaders[pipe.response.orgHeaders[n]] = pipe.response.headers[n];
							
				if(pipe.reverse === true)
					pipe.root.lib.http.reverse.log(pipe, 304);
				else
					pipe.root.lib.http.forward.log(pipe, 304);
				pipe.response.writeHead(304, nHeaders);
				pipe.response.end();
				
				return(true);
			}

			/*
			 * Dump the file as 200 response
			 */
			/* load headers */
			for(var n in headers.headers)
				pipe.response.gjsSetHeader(n, headers.headers[n]);
			
			pipe.response.emit("response", pipe.response, 'cache200');
			
			if(
				pipe.server.isClosing == true || 
				pipe.request.headers.connection == 'close' ||
				(pipe.request.httpVersion == '1.0' && !pipe.request.headers.connection)
				) {
				pipe.response.gjsSetHeader('Connection', 'Close');
				pipe.response.gjsRemoveHeader('keep-alive');
			}
			
			/* fix headers */
			var nHeaders = {};
			for(var n in pipe.response.headers)
				nHeaders[pipe.response.orgHeaders[n]] = pipe.response.headers[n];
			
			pipe.response.writeHead(200, nHeaders);
			var st = fs.createReadStream(hash.file, {
				start: headers.headerSerialPos
			});

// 			pipe.root.lib.core.ipc.send('LFW', 'pipeStatus', {
// 				host: pipe.request.headers.host,
// 				hits: true
// 			});
				
			pipe.response.gjsCache = 'hit';
// 			console.log('HIT 200', pipe.request.url);
				
// 			var counter = 0;
// 			st.on('data', function(data) { counter += data.length; });
// 			pipe.response.on('finish', function() {
// 				pipe.root.lib.core.ipc.send('LFW', 'pipeStatus', {
// 					host: pipe.request.headers.host,
// 					hitsBand: counter
// 				});
// 			});

			if(pipe.reverse === true)
				pipe.root.lib.http.reverse.logpipe(pipe, st);
			else
				pipe.root.lib.http.forward.logpipe(pipe, st);
			/* check */
			return(true);
		}
		else {
			/* so remove request headers */
			delete pipe.request.headers['if-modified-since'];
			delete pipe.request.headers['if-none-match'];
		}

		return(false);
	}

	/* sanatization */
	if(!pipe.root.serverConfig.dataDir) {
		pipe.root.lib.core.logger.error('You need to provide dataDir in configuration');
		return(false);
	}
	if(!opts.ignoreCache)
		opts.ignoreCache = false;
	if(!opts.exclusive)
		opts.exclusive = false;
	if(!opts.feeding)
		opts.feeding = true;
	
	var cacheDir = pipe.root.serverConfig.dataDir+"/cache/";
	var tmpDir = pipe.root.serverConfig.dataDir+"/proxy/";

	if(pipe.request.forceCache != true) {
		if(pipe.request.urlParse.pathname == '/')
			return(false);
		if(pipe.request.method != 'GET')
			return(false);
		if(pipe.request.headers.range || pipe.request.headers['content-range'])
			return(false);
	}

	
	/*
	 * Take encoding in case
	 */
	if(pipe.request.headers['accept-encoding']) {
		var hae = pipe.request.headers['accept-encoding'].split(',');
		var a;
		for(a in hae) {
			if(tryToStream(hae[a].trim()) == true) {
				pipe.pause();
				return(true);
			}
		}
	}
	if(tryToStream('') == true) {
		pipe.pause();
		return(true);
	}

	var pipeProxyPassRequest = (function(pipe, request, response) {
		/*
		 * check Pragma
		 */
		if(opts.exclusive == true && pipe.pipeStoreHit != true)
			return;
		if(pipe.request.forceCache != true && response.headers.pragma == "no-cache")
			return;
		if(pipe.response.doNotUse == true) {
	// 		console.log('blocked at do not use');
			request.abort();
			pipe.stop();
			return;
		}

		/*
		 * Manage cache control
		 */
		var cacheControl;
		var cacheControlMaxAge = -1;
		if(pipe.request.forceCache != true && response.headers['cache-control']) {
			var a, b;
			cacheControl = response.headers['cache-control'].split(", ");
			for(a in cacheControl) {
				if(cacheControl[a] == "private" && opts.ignoreCache != true)
					return;
				else if(cacheControl[a] == "must-revalidate" && opts.ignoreCache != true)
					return;
				else if(cacheControl[a] == "no-cache" && opts.ignoreCache != true)
					return;
				else if(b = cacheControl[a].match(/max-age=(.*)/))
					cacheControlMaxAge = b[1];
				else if(b = cacheControl[a].match(/s-maxage=(.*)/))
					cacheControlMaxAge = b[1];
			}
		}

		/* Create hash */
		var date = new Date();
		var input = '';
		if(response.headers['content-encoding'])
		input = response.headers['content-encoding'];
		
		var base;
		if(pipe.request.urlParseCacheStore)
			base = url.format(pipe.request.urlParseCacheStore)+input;
		else
			base = pipe.request.headers.host+url.format(pipe.request.urlParse)+input;

		var hash = pipe.root.lib.acn.generateInHash(opts.dirDiviser, base);
		
		/* store header cache file */
		var header = {
			needDump: false,
			hash: hash.hash,
			cacheTimer: date.getTime(),
			headers: {}
		};
		for(var a in response.headers)
			header.headers[response.orgHeaders[a]] = response.headers[a];
		
		/* file management: if it exists then remove it */
		try {
			var fss = fs.statSync(hash.file);
			try {
				fs.unlinkSync(hash.file);
			} catch(e) {
// 				console.log("Can not delete file "+hash.file+" #"+e.code);
				return(false);
			}
		} catch(e) {
			/* file doesn't exist / do nothing */
		}
		
		/* create dirs for local cache */
		var stage = '';
		var tab = hash.file.split("/");
		for(var a = 1; a<tab.length-1; a++) {
			stage += '/'+tab[a];
			try  { fs.mkdirSync(stage); }
			catch(e) { }
		}

		/* remove headers */
		delete header.headers.connection;
		delete header.headers["set-cookie"];

		/* here we store datas */
		if(response.statusCode == 200 || response.statusCode == 206) {
			/* create tempory files */
			stage = '';
			tab = hash.tmpFile.split("/");
			for(var a = 1; a<tab.length-1; a++) {
				stage += '/'+tab[a];
				try  { fs.mkdirSync(stage); }
				catch(e) { }
			}

			/* check if we need to store the max age */
			if(cacheControlMaxAge > 0)
				header.ccMaxAge = cacheControlMaxAge;

			header.needDump = false;
			var fileHdr = JSON.stringify(header)+"\n";

			/* write stream */
			var st = fs.createWriteStream(hash.tmpFile);
			st.on('error', function(err) { console.log(err); });
			st.write(fileHdr);
			pipe.response.fileIsCaching = st;
			pipe.response.fileHash = hash;

	// 	    pipe.root.lib.bwsFg.acn.pushDigest(pipe, hash);
			
			/* normal source end */
			pipe.response.on('finish', (function() {
	// 			pipe.root.lib.bwsFg.acn.popDigest(pipe);
				
				try {
	// 				fs.renameSync(pipe.response.fileHash.tmpFile, pipe.response.fileHash.file);
					fs.rename(pipe.response.fileHash.tmpFile, pipe.response.fileHash.file, function (err) {
						if (err) console.log('rename error '+err);
					});
				} catch(e) {
					console.log("Rename file "+pipe.response.fileHash.tmpFile+" #"+e.code);
					
					try {
						fs.unlinkSync(pipe.response.fileHash.tmpFile);
					} catch(e) {
						console.log("Can not delete file "+hash.file+" #"+e.code);
						return(false);
					}
					
				}
				st = null;
				
			}));
			
			pipe.request.on('close', (function() {
				if(st)
					st.close();
				try {
					fs.unlinkSync(pipe.response.fileHash.tmpFile);
				} catch(e) {
					console.log("Can not delete file "+hash.file+" #"+e.code);
					return(false);
				}

			
			}));
			
			
			response.pipe(st);

// 			console.log('MISS: '+pipe.request.url);
		}
		/* store partial data at lookup time remove cache headers */
		else if(response.statusCode == 304 && opts.feeding == true) {
			header.needDump = true;
			var fileHdr = JSON.stringify(header)+"\n";

			fs.writeFile(hash.file, fileHdr, function (err) {
				if (err) {
					console.log("Could not save "+hash.file+" with error code "+err.code);
					return;
				}
			});

		}
// 		else
// 			console.log('MISS '+response.statusCode, pipe.request.url);
	});

	/*
	 * Proxy events
	 */
	/* when user closed the connection before */
	pipe.request.on('close', function() {
		pipe.response.doNotUse = true;
	});

	/* request emition */
	if(pipe.reverse === true) 
		pipe.response.on("rvProxyPassPassRequest", (function(pipe, req, res) {
			pipeProxyPassRequest(pipe, req, res);
		}));
	else
		pipe.response.on("fwProxyPassPassRequest", (function(pipe, req, res) {
			pipeProxyPassRequest(pipe, req, res);
		}));
	
	return(false);
}

cache.ctor = function(pipe) {
	cache.gjs = pipe;

//     if(!cluster.isMaster)
//         return;
// 
// 
//     var exec = require('child_process').exec;
// 
//     var cacheDir = pipe.serverConfig.dataDir+"/cache";
// 
//     function processSubDir(dir) {
//         try {
//             var d = fs.readdirSync(dir), a;
//             for(a in d) {
//                 var file = dir+'/'+d[a];
//                 var fss = fs.statSync(file);
// 
//                 if(fss.isFile()) {
//                     var hdr = loadHeaderFile(file),
//                     isF = pipe.root.lib.acn.isFresh(hdr);
//                     if(isF == false) {
//                         try {
//                             fs.unlinkSync(file);
//                         } catch(e) { /* do nothing */ }
//                     }
//                 }
//                 else if(fss.isDirectory())
//                     processSubDir(file);
//             }
//         } catch(e) { /* do nothing */ }
//     }
// 
//     function bgChecker() {
//         processSubDir(cacheDir);
// 
//         /* clean empty dirs */
//         var c = 'find '+cacheDir+' -empty -delete', child;
//         child = exec(c, function (error, stdout, stderr) {
//             if (error !== null)
//                 console.log('exec error: ' + error);
//         });
// 
//     }

    //setInterval(bgChecker, 60*60*1000);
}

module.exports = cache; 
