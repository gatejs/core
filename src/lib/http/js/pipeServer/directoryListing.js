/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * directoryListing opcode [http://www.binarysec.com]
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

var fs = require("fs");

var directoryListing = function(gjs) { }

directoryListing.request = function(pipe, options) {

	if(!pipe.fileInfo)
		return(false);
	
	if(!pipe.fileInfo.isDirectory())
		return(false);
	
	var sortableDirs = [];
	var dirs = fs.readdirSync(pipe.file);
	for(var a in dirs) {
// 		sortableDirs.push(dirs[
		
		try {
			var info = fs.statSync(pipe.file+dirs[a]);
		} catch(e) {
			/* nothing */
			continue;
		}
		
		sortableDirs.push({
			internalName: pipe.file+dirs[a],
			name: dirs[a],
			info: info
		});
		
	}
	
	sortableDirs.sort(function(a, b) {
		var nameA = a.name.toLowerCase(), nameB=b.name.toLowerCase()
		if (nameA < nameB) //sort string ascending
			return(-1)
		if (nameA > nameB)
			return(1)
		return(0)
	})
	
// 	console.log(sortableDirs);
	
	
	pipe.stop();
	pipe.response.write(JSON.stringify(sortableDirs));
	pipe.response.end();

	
	
	
}

directoryListing.ctor = function(gjs) {


}

module.exports = directoryListing;


