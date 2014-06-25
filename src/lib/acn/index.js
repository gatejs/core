/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Associative Cache Network [http://www.binarysec.com]
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

var net = require("net");
var cluster = require("cluster");
var crypto = require('crypto');
var fs = require('fs');

var service = require(__dirname+'/js/service.js');
var cleaner = require(__dirname+'/js/cleaner.js');

var acn = function(gjs) { /* loader below */ };


acn.loader = function(gjs) {
	acn.cacheDir = gjs.serverConfig.dataDir+"/cache/";
	service.loader(gjs);
	cleaner.loader(gjs);
}

acn.divideHash = function(d, hash) {
	var fileHash = acn.cacheDir;
// 	if(!d || d <= 0 || d >= 10)
		d = 8;
	
	var dig = hash;
	var div = (dig.length-1) / d + 1;
	div = div|0;
	fileHash = fileHash + '/' + dig.substr(0, 1) + '/' + dig.substr(1, div - 1);
	for(var a=div; a<dig.length; a+=div)
		fileHash = fileHash + '/' + dig.substr(a, div);
	return({
		file: fileHash,
		hash: hash,
		tmpFile: acn.cacheDir + '/' + dig.substr(0, 1) + '/proxy/' + Math.random()
	});
}

acn.generateInHash = function(division, input) {
	var hash = crypto.createHash('md5');
	hash.update(input, 'ascii');
	var h = hash.digest('hex');
	return(acn.divideHash(division, h));
}

acn.loadHeaderFile = function(file) {
	try {
		var fd = fs.openSync(file, 'r'),
		readBuffer = new Buffer(5000),
		headerSerial = new  Buffer(5000),
		headerSerialPos = 0,
		nbytes,
		tbytes = 0,
		found = false;

		do {
			inBytes = 0;
			nbytes = fs.readSync(fd, readBuffer, 0, 100, null);
			for(var a = 0; a<nbytes; a++) {
				headerSerial[headerSerialPos] = readBuffer[a];
				headerSerialPos++;
				if(readBuffer[a] == 10) {
				found = true;
				break;
				}
			}
			tbytes += nbytes;
			if(nbytes == 0 || found == true)
				break;

			/* can not find */
			if(tbytes >= 5000) {
				console.log("warning file "+file+" seems to have a very big header. deleting. ");
				fs.closeSync(fd);
				fs.unlinkSync(file);
				return(false);
			}
		} while(1);


	} catch(e) {
		if(e.errno != 34)
		console.log(e);

		return(false);
	}
	fs.closeSync(fd);

	
	try {
		var headers = JSON.parse(headerSerial.toString('utf-8', 0, headerSerialPos));
		headers.headerSerialPos = headerSerialPos;
		return(headers);
	} catch(e) {
		return(false);
	}
	return(false);
}

acn.isFresh = function(hdr, maxAge) {
	if(!hdr)
		return(false);
	
	var date = new Date;
	if(!maxAge) {

		if(hdr.headers['content-type']) {
			if(hdr.headers['content-type'].match(/text/))
				maxAge = 0;
			else if(hdr.headers['content-type'].match(/javascript/))
				maxAge = 800;
			else
				maxAge = 120000;
		}
		else
			maxAge = 120000;
	}
	/*
	* Check the cache control timer
	*/
	if(hdr.ccMaxAge > 0)
		maxAge = hdr.ccMaxAge;
	
	var currentAge = (date.getTime()-hdr.cacheTimer)/1000;
	if(currentAge > maxAge)
		return(false);

	return(true);
}


module.exports = acn;


