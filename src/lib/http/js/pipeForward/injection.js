/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Reverse proxy content injection opcode [http://www.binarysec.com]
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


var util = require('util');
var zlib = require('zlib');
var fs = require('fs');
var Stream = require("stream");

var injection = function() {}

injection.request = function(pipe, options) {

	if(options === undefined)
		options = {};

	/* defaulting options */
	var contentType = "text/html";
	if(options.contentType !== undefined)
		contentType = options.contentType;

	var event = "rvProxyPassPassRequest";
	if(pipe.forward === true)
		event = "fwProxyPassPassRequest";

	pipe.request.noCache = true;

	/* receive response */
	pipe.response.on(event, function(pipe, req, res) {
		var ctrl = false;

		if(res.statusCode != 200)
			return;

		if(res.headers['content-type'])
			var iCt = res.headers['content-type'].split(';')[0];

		if(typeof contentType == "string") {
			if(contentType == iCt)
				ctrl = true;
		}

		if(ctrl == true) {
			function interpretation(dIn, dOut) {
				var token = 0;

				dIn.on('data', function(data) {
					var dataStr = data.toString();
					var block = true;
					var dataRetrans = true;

					while(block) {
						switch(token) {
							/* <body> */
							case 0:
								if(dataStr.indexOf('<body') >= 0)
									token = 1;
								else
									block = false;
								break;

							/* </body> */
							case 1:

								var pos = dataStr.indexOf('</body>'); // 7
								if(pos >= 0) {
									var newBody;
									if(typeof options.func === 'function') {
										newBody = dataStr.substr(0, pos)+
										"\n"+options.func()+"\n\n</body>\n"+
										dataStr.substr(pos+7);
									}
									else {
										newBody = dataStr.substr(0, pos)+
										"\n"+options.code+"\n\n</body>\n"+
										dataStr.substr(pos+7);
									}

									dataRetrans = false;
									dOut.write(newBody);
									token = 2;
								}

								block = false;
								break;

							case 2:
								block = false;
								break;
						}
					}

					if(dataRetrans == true)
						dOut.write(data);

				});

				dIn.on('end', function() {
					dOut.end();
				});

				/* put response in gunzip */
				if(res != dIn)
					res.pipe(dIn);

				/* derivate server output */
				pipe.subPipe = dOut;
			}

			/* check for gzip content */
			if(res.headers['content-encoding'] == 'gzip') {
				delete res.headers['content-length'];

				interpretation(zlib.createGunzip(), zlib.createGzip());
			}
			else if(res.headers['content-encoding'] == 'deflate') {
				delete res.headers['content-length'];
				interpretation(zlib.createInflate(), zlib.createDeflate());
			}
			else {
				delete res.headers['content-length'];
				interpretation(res, new Stream.PassThrough);
			}
		}
	});
}

injection.ctor = function(gjs) { }


module.exports = injection;
