all:
	cd ./src/lib/core && node-gyp rebuild
	if test $$(uname -s) = "Linux"; then cd ./src/lib/tproxy && node-gyp rebuild; fi
