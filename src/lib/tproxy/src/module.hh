#ifndef _H_TPROXY_MODULE
#define _H_TPROXY_MODULE

#include <node.h>

#include <string>

#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <cerrno>

#include <sys/types.h>
#include <sys/socket.h>
#include <linux/if.h>
#include <linux/if_tun.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <linux/fs.h>
#include <endian.h>
#include <limits.h>
#include <linux/netfilter_ipv4.h>

#ifndef IP_TRANSPARENT
#define IP_TRANSPARENT 19
#endif

#include "tproxy.hh"

#define THROW(str) \
	ThrowException(Exception::Error(String::New(str)))

#define THROW_TYPE(str) \
	ThrowException(Exception::TypeError(String::New(str)))

#endif

