/*
 * Copyright (c) 2010-2017 BinarySEC SAS
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

const cluster = require("cluster");
const path = require('path');
const fs = require('fs');
const diskusage = require('diskusage');

var cleaner = function(gjs) {}

cleaner.loader = function(gjs) {
	cleaner.gjs = gjs;

	var stats = {};

	function resetStats() {
		stats = {
			filesAnalyzed: 0,
			filesRemoved: 0,
			dirsAnalyzed: 0,
			dirsRemoved: 0,
			sizeAnalyzed: 0,
			sizeRemoved: 0
		};
	}

	function updateStats() {
		gjs.lib.core.ipc.send('RFW', 'acnCleaner', stats);

		resetStats();
		setTimeout(updateStats, cUpdateTimeout)
	}

//	if(gjs.serverConfig.acn) {
//		if(gjs.serverConfig.acn.cleanDelay)
//			delay = gjs.serverConfig.acn.cleanDelay*1000;
//		if(gjs.serverConfig.acn.cleanInterval)
//			interval = gjs.serverConfig.acn.cleanInterval;
//	}

	if(cluster.isMaster) {
		var listToStat = [];
		var listToProcess = [];
		var listToRemove = [];
		var listToDir = [];

		var cSleepingState = 10000;
		var cProcessingDay = 10;
		var cProcessingNight = 0;
		var cUpdateTimeout = 10000;
		var cInitMaxAge = 60*60*24*7;
		var cMaxAge = cInitMaxAge;

		var currentProcessing = cProcessingDay;

		/* * * * * * * * * * * * * * * * * * * * * * * * * *
		 *
		 * Adapte max age with disk space
		 * * * * * * * * * * * * * * * * * * * * * * * * * */
		function computeMaxAge() {
			diskusage.check(gjs.lib.acn.cacheDir, function(err, info) {
				if(!err) {
					var cFreePer = 100*info.available/info.total;
					var level = 100-cFreePer;
					var curveAge = cInitMaxAge/Math.exp(level/50);
					cMaxAge = Math.round(curveAge-(level*curveAge/100));
					if(cMaxAge <= 0)
						cMaxAge = 1;

					// add expo curve
					//console.log('Adaptative cache', level, cMaxAge);
				}
				setTimeout(computeMaxAge, 60000);
			});
		}
		setTimeout(computeMaxAge, 1000);


		/* * * * * * * * * * * * * * * * * * * * * * * * * *
		 *
		 * Select processing level
		 * * * * * * * * * * * * * * * * * * * * * * * * * */
		function processingLevel() {
			var h = new Date().getHours();

			if(h>=23 || h<=5) {
				if(currentProcessing != cProcessingNight) {
					console.log('Switch to night cache cleaning processing level');
					currentProcessing = cProcessingNight;
				}
			}
			else if(currentProcessing != cProcessingDay) {
				console.log('Switch to day cache cleaning processing level');
				currentProcessing = cProcessingDay;
			}

			setTimeout(processingLevel, 60000);
		}
		processingLevel();

		// start stater
		resetStats();
		setTimeout(updateStats, cUpdateTimeout)

		/* * * * * * * * * * * * * * * * * * * * * * * * * *
		 *
		 * Very async stat()
		 * * * * * * * * * * * * * * * * * * * * * * * * * */
		function popToStat() {
			var el = listToStat.pop();
			if(!el)
				return(setTimeout(popToStat, cSleepingState));
			//console.log('fs.stat(): '+el);
			fs.stat(el, (err, fss) => {
				if(err)
					return(setTimeout(popToStat, currentProcessing));

				if(fss.isFile())
					listToProcess.push(el);
				else if(fss.isDirectory())
					listToDir.push(el);

				stats.sizeAnalyzed += fss.size;
				setTimeout(popToStat, currentProcessing)
			});
		}

		setTimeout(popToStat, currentProcessing)

		/* * * * * * * * * * * * * * * * * * * * * * * * * *
		 *
		 * Very async processor
		 * * * * * * * * * * * * * * * * * * * * * * * * * */
		function popToProcess() {
			var file = listToProcess.pop();
			if(!file)
				return(setTimeout(popToProcess, cSleepingState));

			//console.log('processing(): '+file);

			stats.filesAnalyzed++;

			var hdr = gjs.lib.acn.loadHeaderFile(file),
			isF = gjs.lib.acn.isFresh(hdr, cMaxAge, true);
			if(isF == false) {
				stats.filesRemoved++;
				try {
					//console.log(file);
					fs.unlinkSync(file);
				} catch(e) { /* do nothing */ }
			}

			setTimeout(popToProcess, currentProcessing)
		}

		setTimeout(popToProcess, currentProcessing);


		/* * * * * * * * * * * * * * * * * * * * * * * * * *
		 *
		 * Very async readdir()
		 * * * * * * * * * * * * * * * * * * * * * * * * * */
		function popToDir() {
			var dir = listToDir.pop();
			if(!dir)
				return(setTimeout(popToDir, cSleepingState));

			stats.dirsAnalyzed++;
			//console.log('fs.readdir(): '+dir);
			fs.readdir(dir, function(err, list) {
				if(err)
					return(setTimeout(popToDir, currentProcessing));
				for(var i = 0 ; i < list.length ; i++)
					listToStat.push(dir + path.sep + list[i]);

				// no files into dirs
				if(list.length == 0) {
					stats.dirsRemoved++;

					// no need to control the end
					fs.rmdir(dir, () => {});
				}

				setTimeout(popToDir, currentProcessing)
			});
		}

		setTimeout(popToDir, currentProcessing)

		/* * * * * * * * * * * * * * * * * * * * * * * * * *
		 *
		 * Check to reinit the process
		 * * * * * * * * * * * * * * * * * * * * * * * * * */
		function recycle() {
			//console.log(listToStat, listToProcess, listToRemove, listToDir)
			if(
				listToStat.length == 0 &&
				listToProcess.length == 0 &&
				listToRemove.length == 0 &&
				listToDir.length == 0) {
				listToStat.push(gjs.lib.acn.cacheDir);
				setTimeout(recycle, cSleepingState)
				return;
			}

			setTimeout(recycle, cSleepingState);
		}

		setTimeout(recycle, 5000);
	}


}


module.exports = cleaner;
