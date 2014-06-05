gate
====

GateJS is a performant &amp; scalable forward &amp; reverse HTTP proxy based on
node.js + V8.

Installation
------------

### TLDR ###
To build and install gatejs, run the following commands :

	$ ./configure
	$ make
	# sudo make install

### Installation from git ###
To install this project from git, you will have to run the following command :

	$ git clone https://github.com/binarysec/gate.git gate

However, since it depends from other projects, you will also have to 
retrieve their sources, with :

	$ cd gate
	$ git submodule init
	$ git submodule sync
	$ git submodule update

### Available options ###
The `configure` script have the following options :
* `--prefix-share` : The path where the static data will be written. Defaults to
  `/usr/local/share`.
* `--prefix-conf` : The path where the configuration file will be copied.
  Defaults to `/etc`.
* `--prefix-bin` : The path where the gatejs program will be installed. Defaults
  to `/usr/local/sbin`.
* `--prefix-var` : The path where the temporary files will be written (PID file,
  sockets, ...). Defaults to `/var`.
* `--prefix-data` : The path where the persistent data will be written (Cache
  files). Defaults to `/home/gatejs-data`.
* `--help` : Show a short help text.
