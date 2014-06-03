NODE_GYP=node-gyp

all: build

build: build/Release/core.node

build/Release/core.node: src/*.cc src/*.hh
	$(NODE_GYP) build

config: configure

configure:
	$(NODE_GYP) configure

clean:
	$(NODE_GYP) clean

rebuild:
	$(NODE_GYP) clean configure build

