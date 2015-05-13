gate
====
### Website: www.gatejs.org
GateJS is a javascript based reverse &amp; forward proxy with high 
performance &amp; capability.

For more informations about gatejs & configuration please visit the wiki at https://github.com/binarysec/gate/wiki


**note**: gatejs team is looking for someone to maintain debian packages, contact us at info [at] binarysec [dot] com

Learn more about gatejs contribution @ https://github.com/binarysec/gate/wiki/Contribution

[![][travis-build-img]][travis-build-url]
[![][gt-issues]][gt-issues]
[![][gt-forks]][gt-forks]
[![][gt-stars]][gt-stars]
[![][gt-licence]][gt-licence]

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
apt-get install gcc make g++ python
```

## Forward proxy configuration example
```js
var serverConfig = function(bs) { return({
    serverProcess: 4,
    hostname: "testServer0",
    runDir: "/var/run/gatejs",
    dataDir: "/home/gatejs-data",
    logDir: "/var/log/gatejs",
    confDir: '/etc/gatejs',

    http: {
        forwardInterface: {
            type: 'forward',
            port: 80,
            pipeline: 'pipetest'
        }
    },

    pipeline: {
        pipetest: [
            ['cache', { }],
            ['proxyPass', { mode: 'host', timeout: 10 }]
        ],
    }

})};

module.exports = serverConfig;
```

[travis-build-img]: https://secure.travis-ci.org/binarysec/gate.png
[travis-build-url]: http://travis-ci.org/binarysec/gate
[gt-issues]: https://img.shields.io/github/issues/binarysec/gate.svg
[gt-forks]: https://img.shields.io/github/forks/binarysec/gate.svg
[gt-stars]: https://img.shields.io/github/stars/binarysec/gate.svg
[gt-licence]: https://img.shields.io/badge/license-GPLv3-blue.svg
