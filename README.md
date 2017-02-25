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

You need to install before NodeJS >4.x.x. Once nodejs is installed you can run:

	$ npm install -g gatejs

### Installation from git
To install this project from git, you will have to run the following command :

	$ git clone https://github.com/binarysec/gate.git gate
	$ cd gate
	$ npm install

If you downloaded the zip from github, you will have to fetch the submodules
yourself.

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
