gate
====

GateJS is a javascript based reverse &amp; forward proxy with high 
performance &amp; capability.

For more informations about gatejs & configuration please visit the wiki at https://github.com/binarysec/gate/wiki


**note**: gatejs team is looking for someone to maintain debian packages, contact us at info [at] binarysec [dot] com

[![build status](https://secure.travis-ci.org/binarysec/gate.png)](http://travis-ci.org/binarysec/gate)

## Installation

### TLDR
To build and install gatejs, run the following commands :

	$ ./configure
	$ make
	# sudo make install

### Installation from git
To install this project from git, you will have to run the following command :

	$ git clone --recurse-submodules https://github.com/binarysec/gate.git gate

If you forgot the `--recurse-submodules`, the submodules will be downloaded
automatically by the make step. Optionally, you can also use :

	$ cd gate
	$ git submodule update --init --recursive

or :

	$ make git-submodules-up

If you downloaded the zip from github, you will have to fetch the submodules 
yourself.

### Available options
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

## System spec

### Debian packages
```bash
apt-get install gcc make g++
```
