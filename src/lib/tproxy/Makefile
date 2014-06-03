NODE_GYP=node-gyp

all: build

build: build/Release/bhutils.node

build/Release/bhutils.node: src/*.cc src/*.hh
	$(NODE_GYP) build

config: configure

configure:
	$(NODE_GYP) configure

clean:
	$(NODE_GYP) clean

rebuild:
	$(NODE_GYP) clean configure build

