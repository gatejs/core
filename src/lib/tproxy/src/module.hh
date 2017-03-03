/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy base module header [http://www.binarysec.com]
 * 
 * This file is part of Gate.js.
 * 
 * Gate.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef _H_TPROXY_MODULE
#define _H_TPROXY_MODULE

#include <node.h>
#include <node_object_wrap.h>

#include <uv.h>

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
#include <netinet/in.h>
#include <netinet/ip.h>

#ifndef IP_TRANSPARENT
#define IP_TRANSPARENT 19
#endif

#include "tproxy.hh"

#define THROW(str) \
	isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, str)))

#define THROW_TYPE(str) \
	isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, str)))

#endif

