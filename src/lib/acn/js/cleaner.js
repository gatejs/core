/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Associative Cache Network cleaner [http://www.binarysec.com]
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
 */


var cluster = require("cluster");
var path = require('path');
var fs = require('fs');

var cleaner = function(gjs) {}

cleaner.loader = function(gjs) {
	cleaner.gjs = gjs;

	return;
	
	var delay = 43200000;
	var interval = 250;

	if(gjs.serverConfig.acn) {
		if(gjs.serverConfig.acn.cleanDelay)
			delay = gjs.serverConfig.acn.cleanDelay*1000;
		if(gjs.serverConfig.acn.cleanInterval)
			interval = gjs.serverConfig.acn.cleanInterval;
	}

	if(cluster.isMaster) {
		var running = true;
		var toProcess = [];

		function processFile(file) {
			var hdr = gjs.lib.acn.loadHeaderFile(file),
			isF = gjs.lib.acn.isFresh(hdr);
			if(isF == false) {
				try {
					fs.unlinkSync(file);
				} catch(e) { /* do nothing */ }
			}
		}

		function processDir(dir) {
			var waiting = 0;
			
			fs.readdir(dir, function(err, list) {
				if(err)
					return(checkNext());
				for(var i = 0 ; i < list.length ; i++) {
					var file = dir + path.sep + list[i];
					waiting++;
					fs.stat(file, onStats.bind(null, file));
				}
				
				checkNext();
			});
			
			function onStats(fpath, err, fss) {
				waiting--;
				if(err)
					return(checkNext());
				
				if(fss.isFile())
					processFile(fpath);
				else if(fss.isDirectory())
					toProcess.push(fpath);
				
				checkNext();
			}
			
			function checkNext() {
				if(waiting > 0)
					return;
				
				if(toProcess.length > 0)
					setTimeout(processDir, 1, toProcess.pop());
				else
					running = false;
			}
		}

		function recycle() {
			running = true;
			setInterval(function() {
				if(running == false) {
					clearInterval(this);
					setTimeout(recycle, delay);
				}
			}, 10000);
			processDir(gjs.lib.acn.cacheDir);
		}

		setTimeout(recycle, delay);
	}


}


module.exports = cleaner;
