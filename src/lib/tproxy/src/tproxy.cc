/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy module sources [http://www.binarysec.com]
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

#include "module.hh"

using namespace v8;

void Tproxy::Init(Handle<Object> exports) {
#define SETFUNC(_name_) \
		exports->Set(String::NewSymbol(#_name_), \
		FunctionTemplate::New(_name_)->GetFunction());
	
	SETFUNC(setTproxyFD)
	SETFUNC(newTproxyFD)
	SETFUNC(newTproxyClientFD)
	SETFUNC(newTproxyServerFD)
	SETFUNC(getTproxyRealDest)
	SETFUNC(debugCheckFD)
	
#undef SETFUNC
}

Handle<Value> Tproxy::setTproxyFD(const v8::Arguments& args) {
	HandleScope scope;
	int option = 1;
	int fd;
	int ret;
	
	if(!args[0]->IsNumber())
		return(THROW_TYPE("Wrong argument type"));
	
	fd = args[0]->ToInteger()->Value();
	
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	return(scope.Close(Boolean::New(true)));
}

Handle<Value> Tproxy::newTproxyFD(const v8::Arguments& args) {
	HandleScope scope;
	int option = 1;
	int version;
	int fd;
	int ret;
	int flags;
	
	if(!args[0]->IsNumber())
		return(THROW_TYPE("Wrong argument type"));
	
	version = args[0]->ToInteger()->Value();
	
	if(version == 4) {
		fd = socket(
			PF_INET,
			SOCK_STREAM,
			0
		);
	}
	else if(version == 6) {
		fd = socket(
			PF_INET6,
			SOCK_STREAM,
			0
		);
	}
	else {
		return(THROW("Invalid IP version (use 4 or 6)"));
	}
	
	if(fd < 0)
		return(THROW("Call of socket() failed"));
	
	option = 1;
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	option = 1;
	ret = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1)
		return(THROW("Call of fcntl(F_GETFL) failed"));
	
	flags |= O_NONBLOCK;
	ret = fcntl(fd, F_SETFL, flags);
	if(ret == -1)
		return(THROW("Call of fcntl(F_SETFL) failed"));
	
	return(scope.Close(Integer::New(fd)));
}

Handle<Value> Tproxy::newTproxyClientFD(const Arguments& args) {
	HandleScope scope;
	struct sockaddr sa;
	int sa_size;
	std::string bind_addr;
	int bind_port;
	int version;
	int flags;
	int option;
	int fd;
	int ret;
	
	if(!args[0]->IsString())
		return(THROW_TYPE("Wrong argument type"));
	if(args[1]->IsNumber())
		bind_port = args[1]->ToInteger()->Value();
	else
		bind_port = 0;
	
	String::AsciiValue in_addr(args[0]->ToString());
	bind_addr = *in_addr;
	
	
	version = Tproxy::getIpType(bind_addr.c_str());
	
	if(version == 4) {
		struct sockaddr_in sai;
		
		fd = socket(
			PF_INET,
			SOCK_STREAM,
			0
		);
		
		sai = uv_ip4_addr(bind_addr.c_str(), bind_port);
		sa_size = sizeof(sai);
		memcpy(&sa, &sai, sa_size);
	}
	else if(version == 6) {
		struct sockaddr_in6 sai6;
		
		fd = socket(
			PF_INET6,
			SOCK_STREAM,
			0
		);
		
		sai6 = uv_ip6_addr(bind_addr.c_str(), bind_port);
		sa_size = sizeof(sai6);
		memcpy(&sa, &sai6, sa_size);
	}
	else {
		return(THROW("IP version not found"));
	}
	
	if(fd < 0)
		return(THROW("Call of socket() failed"));
	
	option = 1;
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	option = 1;
	ret = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	ret = bind(fd, &sa, sa_size);
	
	if(ret == -1)
		return(THROW("Call of bind() failed"));
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1)
		return(THROW("Call of fcntl(F_GETFL) failed"));
	
	flags |= O_NONBLOCK;
	ret = fcntl(fd, F_SETFL, flags);
	if(ret == -1)
		return(THROW("Call of fcntl(F_SETFL) failed"));
	
	return(scope.Close(Integer::New(fd)));
}

Handle<Value> Tproxy::newTproxyServerFD(const Arguments& args) {
	HandleScope scope;
	struct sockaddr sa;
	int sa_size;
	std::string bind_addr;
	int bind_port;
	int version;
	int backlog;
	int flags;
	int option;
	int fd;
	int ret;
	
	if(!args[0]->IsString())
		return(THROW_TYPE("Wrong argument type"));
	if(!args[1]->IsNumber())
		return(THROW_TYPE("Wrong argument type"));
	
	String::AsciiValue in_addr(args[0]->ToString());
	bind_addr = *in_addr;
	bind_port = args[1]->ToInteger()->Value();
	if(!args[2]->IsNumber())
		backlog = 1024;
	else
		backlog = args[2]->ToInteger()->Value();
	
	version = Tproxy::getIpType(bind_addr.c_str());
	
	if(version == 4) {
		struct sockaddr_in sai;
		
		fd = socket(
			PF_INET,
			SOCK_STREAM,
			0
		);
		
		sai = uv_ip4_addr(bind_addr.c_str(), bind_port);
		sa_size = sizeof(sai);
		memcpy(&sa, &sai, sa_size);
	}
	else if(version == 6) {
		struct sockaddr_in6 sai6;
		
		fd = socket(
			PF_INET6,
			SOCK_STREAM,
			0
		);
		
		sai6 = uv_ip6_addr(bind_addr.c_str(), bind_port);
		sa_size = sizeof(sai6);
		memcpy(&sa, &sai6, sa_size);
	}
	else {
		return(THROW("IP version not found"));
	}
	
	if(fd < 0)
		return(THROW("Call of socket() failed"));
	
	option = 1;
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	option = 1;
	ret = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &option, sizeof(option));
	if(ret == -1)
		return(THROW("Tproxy setup (setsockopt) failed"));
	
	ret = bind(fd, &sa, sa_size);
	
	if(ret == -1)
		return(THROW("Call of bind() failed"));
	
	ret = listen(fd, backlog);
	
	if(ret == -1)
		return(THROW("Call of listen() failed"));
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1)
		return(THROW("Call of fcntl(F_GETFL) failed"));
	
	flags |= O_NONBLOCK;
	ret = fcntl(fd, F_SETFL, flags);
	if(ret == -1)
		return(THROW("Call of fcntl(F_SETFL) failed"));
	
	return(scope.Close(Integer::New(fd)));
}

Handle<Value> Tproxy::getTproxyRealDest(const Arguments& args) {
	HandleScope scope;
	char dest_addr[INET6_ADDRSTRLEN];
	int dest_port = 0;
	struct sockaddr sa;
	int fd;
	int ret;
	const char *pret;
	const char *family_str;
	socklen_t sa_size;
	
	if(!args[0]->IsNumber())
		return(THROW_TYPE("Wrong argument type"));
	
	fd = args[0]->ToInteger()->Value();
	
	sa_size = sizeof(sa);
	
	//ret = getsockopt(fd, SOL_IP, IP_ORIGDSTADDR, &sa, &sa_size);
	ret = getsockopt(fd, SOL_IP, SO_ORIGINAL_DST, &sa, &sa_size);
	if(ret == -1) {
		std::string s;
		s = strerror(errno);
		s = std::string("getsockopt() call failed : ") + s;
		return(THROW(s.c_str()));
	}
	
	if(sa_size == sizeof(sockaddr_in)) {
		pret = inet_ntop(AF_INET, &sa, dest_addr, sa_size);
		if(pret == NULL)
			return(THROW("inet_ntop() call failed"));
		
		dest_port = ((struct sockaddr_in*)&sa)->sin_port;
		family_str = "IPv4";
	}
	else if(sa_size == sizeof(sockaddr_in6)) {
		pret = inet_ntop(AF_INET6, &sa, dest_addr, sa_size);
		perror("inet_ntop");
		if(pret == NULL)
			return(THROW("inet_ntop() call failed"));
		
		family_str = "IPv6";
		dest_port = ((struct sockaddr_in6*)&sa)->sin6_port;
	}
	else {
		return(THROW("Unknown sockaddr size. It should not happen..."));
	}
	
	Local<Object> ret_obj = Object::New();
	ret_obj->Set(String::New("address"), String::New(dest_addr));
	ret_obj->Set(String::New("family"),  String::New(family_str));
	ret_obj->Set(String::New("port"),    Integer::New(htons(dest_port)));
	
	return(scope.Close(ret_obj));
}

Handle<Value> Tproxy::debugCheckFD(const Arguments& args) {
	HandleScope scope;
	int fd;
	int ret;
	int is_transparent = 0;
	int is_reusable = 0;
	int flags;
	socklen_t sa_size;
	
	if(!args[0]->IsNumber())
		return(scope.Close(String::New("Error parameter (not a number!)")));
	
	fd = args[0]->ToInteger()->Value();
	
	is_transparent = 1;
	sa_size = sizeof(is_transparent);
	ret = getsockopt(fd, SOL_IP, IP_TRANSPARENT, &is_transparent, &sa_size);
	if(ret == -1)
		return(scope.Close(String::New("Error on IP_TRANSPARENT")));
	
	is_reusable = 1;
	sa_size = sizeof(is_reusable);
	ret = getsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &is_reusable, &sa_size);
	if(ret == -1)
		return(scope.Close(String::New("Error on SO_REUSEADDR")));
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1)
		return(scope.Close(String::New("Error on fcntl()")));
	
	Local<Object> obj_ret;
	
	obj_ret = Object::New();
	obj_ret->Set(
		String::New("fd"),
		Number::New(fd)
	);
	obj_ret->Set(
		String::New("is_transparent"),
		Number::New(is_transparent)
	);
	obj_ret->Set(
		String::New("is_reusable"),
		Number::New(is_reusable)
	);
	obj_ret->Set(
		String::New("flags"),
		Number::New(flags)
	);
	
	return(scope.Close(obj_ret));
}

int Tproxy::getIpType(const char *ip) {
	char address_buffer[sizeof(struct in6_addr)];
	
	if (uv_inet_pton(AF_INET, ip, &address_buffer).code == UV_OK) {
		return(4);
	}
	
	if (uv_inet_pton(AF_INET6, ip, &address_buffer).code == UV_OK) {
		return(6);
	}
	
	return(0);
}
