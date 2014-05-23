all: build

build: build/Release/core.node

build/Release/core.node: src/*.cc src/*.hh
	node-gyp build

config: configure

configure:
	node-gyp configure

clean:
	node-gyp clean

rebuild:
	node-gyp clean configure build

