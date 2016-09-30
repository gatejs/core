/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * HTTP serving [http://www.binarysec.com]
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
var log = function() { /* loader below */ };

/*
 * Watch input stream to calculate log
 */
log.log = function(gjs) {
	gjs.root.lib.gjsCore.logger.siteAccess({
		version: gjs.request.httpVersion,
		site: gjs.request.selectedConfig.name,
		ip: gjs.request.remoteAddress,
		code: gjs.response.statusCode,
		method: gjs.request.method,
		url: gjs.request.url,
		outBytes: gjs.request.gjsWriteBytes ? gjs.request.gjsWriteBytes : '0',
		userAgent: gjs.request.headers['user-agent'] ? gjs.request.headers['user-agent'] : '-',
		referer: gjs.request.headers.referer ? gjs.request.headers.referer : '-',
		cache: gjs.response.gjsCache ? gjs.response.gjsCache : 'miss'
	});
}

log.logpipe = function(gjs, src) {
	if(!gjs.request.gjsWriteBytes)
		gjs.request.gjsWriteBytes = 0;

	src.on('data', function(data) {
		gjs.request.gjsWriteBytes += data.length;

	});
	src.on('end', function() {
// 		console.log('src > end');
// 		gjs.request = null;
// 		gjs.response = null;

	});
	src.on('error', function(err) {
// 		console.log('src > error');
// 		console.log("write error logpipe");
// 		gjs.response.destroy();
// 		gjs.request = null;
// 		gjs.response = null;

	});
	gjs.response.on('error', function() {
// 		console.log('res > error');
// 		gjs.request = null;
// 		gjs.response = null;
		src.destroy();
	});
	gjs.response.on('finish', function() {
// 		console.log('res > finish');

// 		gjs.request = null;
// 		gjs.response = null;
		src.destroy();

	});
	src.pipe(gjs.response);


}

log.loader = function(gjs) {



}

module.exports = log;
