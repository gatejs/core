all:
	npm install --prefix ./src/lib/core
	if test $$(uname -s) = "Linux"; then npm install --prefix ./src/lib/tproxy; fi
