gate
====
GateJS is a javascript based reverse &amp; forward proxy with high
performance &amp; capability.

For more informations about gatejs & configuration please visit the wiki at https://github.com/gatejs/core/wiki

Learn more about gatejs contribution @ https://github.com/gatejs/core/wiki/Contribution

[![][travis-build-img]][travis-build-url]
[![][gt-issues]][gt-issues]
[![][gt-forks]][gt-forks]
[![][gt-stars]][gt-stars]
[![][gt-licence]][gt-licence]

## Installation

### TLDR

You need to install before NodeJS >4.x.x. Once nodejs is installed you can run:

	$ sudo npm install -g gatejs

### Installation from git
To install this project from git, you will have to run the following command :

	$ git clone https://github.com/gatejs/core.git gate
	$ cd gate
	$ npm install

If you downloaded the zip from github, you will have to fetch the submodules
yourself.

### Running gatejs
You can use the forever process manager to run and control gatejs.

```bash
mkdir /var/log/gatejs
forever -a -o /var/log/gatejs/forever.log -e /var/log/gatejs/forever-error.log start --uid gatejs --max_old_space_size=150 /usr/bin/gatejs --config=/etc/gatejs/config.js
```

You can also run the command at the reboot time using **cron**!

Add the following lines when editing crontab (crontab -e):
```
@reboot forever -a -o /var/log/gatejs/forever.log -e /var/log/gatejs/forever-error.log start --uid gatejs --max_old_space_size=150 /usr/bin/gatejs --config=/etc/gatejs/config.js
```

**--max_old_space_size=150** allows to control the V8 garbage collector which is set to 150MB.

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

[travis-build-img]: https://secure.travis-ci.org/gatejs/core.png
[travis-build-url]: http://travis-ci.org/gatejs/core
[gt-issues]: https://img.shields.io/github/issues/gatejs/core.svg
[gt-forks]: https://img.shields.io/github/forks/gatejs/core.svg
[gt-stars]: https://img.shields.io/github/stars/gatejs/core.svg
[gt-licence]: https://img.shields.io/badge/license-GPLv3-blue.svg
