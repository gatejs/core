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
var fs = require('fs');

var cleaner = function(gjs) {}

cleaner.loader = function(gjs) {
	cleaner.gjs = gjs;
	
	var delay = 60000;
	var interval = 500;
	
	if(gjs.serverConfig.acn) {
		if(gjs.serverConfig.acn.cleanDelay)
			delay = gjs.serverConfig.acn.cleanDelay;
		if(gjs.serverConfig.acn.cleanInterval)
			interval = gjs.serverConfig.acn.cleanInterval;
	}
	
	if(cluster.isMaster) {
		var reference = 0;
		
		function processFile(args) {
			var hdr = gjs.lib.acn.loadHeaderFile(args.file),
			isF = gjs.lib.acn.isFresh(hdr);
			if(isF == false) {
				try {
					fs.unlinkSync(args.file);
				} catch(e) { /* do nothing */ }
			}
			reference--;
		}
		
		function processDir(dir) {
			try {
				
				var d = fs.readdirSync(dir), a;
				var inInterval = interval;
				for(a in d) {
					var file = dir+'/'+d[a];
					var fss = fs.statSync(file);

					if(fss.isFile()) {
						reference++;
						setTimeout(processFile, inInterval, {file: file, fss: fss});
					}
					else if(fss.isDirectory()) {
						reference++;
						setTimeout(processDir, inInterval, file);
					}
					inInterval += interval;

				}
			} catch(e) { /* do nothing */ }
			reference--;
		}
    
		function recycle() {
			reference = 0;
			setInterval(function() {
				if(reference == -1) {
					clearInterval(this);
					setTimeout(recycle, delay);
				}
			}, delay);
			processDir(gjs.lib.acn.cacheDir);
		}
		
		setTimeout(recycle, delay);
	}
	
	
}


module.exports = cleaner;


