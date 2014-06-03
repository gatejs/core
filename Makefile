all: node libs
	

node:
	cd ./deps/nodejs && ./configure --prefix="/usr/local/share/node"
	+make -C ./deps/nodejs

libs:
	+make -C src/lib/core/ rebuild
	+make -C src/lib/tproxy/ rebuild

install:
	test '!' -e deps/nodejs/out && (echo 'Build node first!'; exit 1)
	echo lala

