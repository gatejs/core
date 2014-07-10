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

// var url = require('url');
var fs = require("fs");

var directoryListing = function(gjs) { }

directoryListing.ignoreList = {
	'.DAV': true,
	'.DS_Store': true,
	'.bzr': true,
	'.bzrignore': true,
	'.bzrtags': true,
	'.git': true,
	'.gitattributes': true,
	'.gitignore': true,
	'.hg': true,
	'.hgignore': true,
	'.hgtags': true,
	'.htaccess': true,
	'.htpasswd': true,
	'.npmignore': true,
	'.Spotlight-V100': true,
	'.svn': true,
	'__MACOSX': true,
	'ehthumbs.db': true,
	'robots.txt': true,
	'Thumbs.db': true
};

directoryListing.request = function(pipe, options) {

	if(!pipe.fileInfo)
		return(false);
	
	if(!pipe.fileInfo.isDirectory())
		return(false);

	/* check ignore list in path */
	var last = pipe.request.urlParse.path.substr(pipe.request.urlParse.path.lastIndexOf("/")+1);
	if(last in directoryListing.ignoreList || pipe.location.directoryListing != true) {
		pipe.stop();
		pipe.root.lib.http.error.renderArray({
			pipe: pipe, 
			code: 403, 
			tpl: "4xx", 
			log: true,
			title:  "Forbidden",
			explain: "No right to list this directory"
		});
		return(false);
	}
	
	var sortableDirs = [];
	var dirs = fs.readdirSync(pipe.file);
	for(var a in dirs) {
		if(dirs[a] in directoryListing.ignoreList)
			continue;
		try {
			var info = fs.statSync(pipe.file+'/'+dirs[a]);

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

	/* prepare information */
	var msg = {};
       
	/* navbar */
	msg.navbar = '';
	var sp = pipe.request.urlParse.path.split('/');
	var linkLayer = '';
	for(var a=1; a<sp.length-1; a++) {
		linkLayer += '/'+sp[a];
		msg.navbar += '<li><a href="'+linkLayer+'">'+sp[a]+'/</a></li>';
	}
	
	/* data info */
	msg.data = '';
	for(var p in sortableDirs)  {
		var el = sortableDirs[p];
		var filename = el.name;
		var link = pipe.request.urlParse.path != '/' ? pipe.request.urlParse.path+'/'+filename : '/'+filename;
		
		var mime = pipe.root.lib.http.littleFs.getMime(filename);
		if(!mime)
			mime = '-';
		
		if(el.info.isDirectory()) 
			msg.data += '<tr><td><a href="'+encodeURI(link)+'"><strong>'+filename+'/</a></strong></td><td>Directory</td><td>'+el.info.mtime+'</td></tr>';
		else
			msg.data += '<tr><td><a href="'+encodeURI(link)+'">'+filename+'</a></td><td>'+mime+'</td><td>'+el.info.mtime+'</td></tr>';
	}
	msg.current = pipe.request.urlParse.path;

	/* send content data */
	var filename = __dirname+'/directoryListing.html';
	
	pipe.response.headers = {
		Server: "gatejs",
		Pragma: 'no-cache',
		'cache-Control': 'max-age=0'
	};
	
	pipe.stop();
	pipe.response.writeHead(200, pipe.response.headers);
	msg.vd = pipe.root.lib.http.littleFs.virtualDirectory;
	var stream = pipe.root.lib.mu2.compileAndRender(filename, msg);
	stream.pipe(pipe.response);
}

directoryListing.ctor = function(gjs) {


}

module.exports = directoryListing;


