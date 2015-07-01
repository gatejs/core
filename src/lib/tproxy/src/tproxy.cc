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

void Tproxy::Init(Handle<Object> module) {
#define SETFUNC(_name_) \
		NODE_SET_METHOD(module, #_name_, _name_);
	
	SETFUNC(setTproxyFD)
	SETFUNC(newTproxyFD)
	SETFUNC(newTproxyClientFD)
	SETFUNC(newTproxyServerFD)
	SETFUNC(getTproxyRealDest)
	SETFUNC(debugCheckFD)
	
#undef SETFUNC
}

void Tproxy::setTproxyFD(const v8::FunctionCallbackInfo<v8::Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	int option = 1;
	int fd;
	int ret;
	
	if(!args[0]->IsNumber()) {
		THROW_TYPE("Wrong argument type");
		return;
	}
	
	fd = args[0]->ToInteger()->Value();
	
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	args.GetReturnValue().Set(Boolean::New(isolate, true));
}

void Tproxy::newTproxyFD(const v8::FunctionCallbackInfo<v8::Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	int option = 1;
	int version;
	int fd;
	int ret;
	int flags;
	
	if(!args[0]->IsNumber()) {
		THROW_TYPE("Wrong argument type");
		return;
	}
	
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
		THROW("Invalid IP version (use 4 or 6)");
		return;
	}
	
	if(fd < 0) {
		THROW("Call of socket() failed");
		return;
	}
	
	option = 1;
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	option = 1;
	ret = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1) {
		THROW("Call of fcntl(F_GETFL) failed");
		return;
	}
	
	flags |= O_NONBLOCK;
	ret = fcntl(fd, F_SETFL, flags);
	if(ret == -1) {
		THROW("Call of fcntl(F_SETFL) failed");
		return;
	}
	
	args.GetReturnValue().Set(Integer::New(isolate, fd));
}

void Tproxy::newTproxyClientFD(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	struct sockaddr sa;
	int sa_size;
	std::string bind_addr;
	int bind_port;
	int version;
	int flags;
	int option;
	int fd;
	int ret;
	
	if(!args[0]->IsString()) {
		THROW_TYPE("Wrong argument type");
		return;
	}
	if(args[1]->IsNumber())
		bind_port = args[1]->ToInteger()->Value();
	else
		bind_port = 0;
	
	String::Utf8Value in_addr(args[0]->ToString());
	bind_addr = *in_addr;
	
	
	version = Tproxy::getIpType(bind_addr.c_str());
	
	if(version == 4) {
		struct sockaddr_in sai;
		
		fd = socket(
			PF_INET,
			SOCK_STREAM,
			0
		);
		
		if(uv_ip4_addr(bind_addr.c_str(), bind_port, &sai) != 0) {
			THROW_TYPE("Invalid IPv4 address");
			return;
		}
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
		
		if(uv_ip6_addr(bind_addr.c_str(), bind_port, &sai6) != 0) {
			THROW_TYPE("Invalid IPv6 address");
			return;
		}
		sa_size = sizeof(sai6);
		memcpy(&sa, &sai6, sa_size);
	}
	else {
		THROW("IP version not found");
		return;
	}
	
	if(fd < 0) {
		THROW("Call of socket() failed");
		return;
	}
	
	option = 1;
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	option = 1;
	ret = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	ret = bind(fd, &sa, sa_size);
	
	if(ret == -1) {
		THROW("Call of bind() failed");
		return;
	}
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1) {
		THROW("Call of fcntl(F_GETFL) failed");
		return;
	}
	
	flags |= O_NONBLOCK;
	ret = fcntl(fd, F_SETFL, flags);
	if(ret == -1) {
		THROW("Call of fcntl(F_SETFL) failed");
		return;
	}
	
	args.GetReturnValue().Set(Integer::New(isolate, fd));
}

void Tproxy::newTproxyServerFD(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
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
	
	if(!args[0]->IsString()) {
		THROW_TYPE("Wrong argument type");
		return;
	}
	if(!args[1]->IsNumber()) {
		THROW_TYPE("Wrong argument type");
		return;
	}
	
	String::Utf8Value in_addr(args[0]->ToString());
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
		
		if(uv_ip4_addr(bind_addr.c_str(), bind_port, &sai) != 0) {
			THROW_TYPE("Invalid IPv4 address");
			return;
		}
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
		
		if(uv_ip6_addr(bind_addr.c_str(), bind_port, &sai6) != 0) {
			THROW_TYPE("Invalid IPv6 address");
			return;
		}
		sa_size = sizeof(sai6);
		memcpy(&sa, &sai6, sa_size);
	}
	else {
		THROW("IP version not found");
		return;
	}
	
	if(fd < 0) {
		THROW("Call of socket() failed");
		return;
	}
	
	option = 1;
	ret = setsockopt(fd, SOL_IP, IP_TRANSPARENT, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	option = 1;
	ret = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &option, sizeof(option));
	if(ret == -1) {
		THROW("Tproxy setup (setsockopt) failed");
		return;
	}
	
	ret = bind(fd, &sa, sa_size);
	
	if(ret == -1) {
		THROW("Call of bind() failed");
		return;
	}
	
	ret = listen(fd, backlog);
	
	if(ret == -1) {
		THROW("Call of listen() failed");
		return;
	}
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1) {
		THROW("Call of fcntl(F_GETFL) failed");
		return;
	}
	
	flags |= O_NONBLOCK;
	ret = fcntl(fd, F_SETFL, flags);
	if(ret == -1) {
		THROW("Call of fcntl(F_SETFL) failed");
		return;
	}
	
	args.GetReturnValue().Set(Integer::New(isolate, fd));
}

void Tproxy::getTproxyRealDest(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	char dest_addr[INET6_ADDRSTRLEN];
	int dest_port = 0;
	struct sockaddr sa;
	int fd;
	int ret;
	const char *pret;
	const char *family_str;
	socklen_t sa_size;
	
	if(!args[0]->IsNumber()) {
		THROW_TYPE("Wrong argument type");
		return;
	}
	
	fd = args[0]->ToInteger()->Value();
	
	sa_size = sizeof(sa);
	
	//ret = getsockopt(fd, SOL_IP, IP_ORIGDSTADDR, &sa, &sa_size);
	ret = getsockopt(fd, SOL_IP, SO_ORIGINAL_DST, &sa, &sa_size);
	if(ret == -1) {
		std::string s;
		s = strerror(errno);
		s = std::string("getsockopt() call failed : ") + s;
		THROW(s.c_str());
		return;
	}
	
	if(sa_size == sizeof(sockaddr_in)) {
		pret = inet_ntop(AF_INET, &sa, dest_addr, sa_size);
		if(pret == NULL) {
			THROW("inet_ntop() call failed");
			return;
		}
		
		dest_port = ((struct sockaddr_in*)&sa)->sin_port;
		family_str = "IPv4";
	}
	else if(sa_size == sizeof(sockaddr_in6)) {
		pret = inet_ntop(AF_INET6, &sa, dest_addr, sa_size);
		perror("inet_ntop");
		if(pret == NULL) {
			THROW("inet_ntop() call failed");
			return;
		}
		
		family_str = "IPv6";
		dest_port = ((struct sockaddr_in6*)&sa)->sin6_port;
	}
	else {
		THROW("Unknown sockaddr size. It should not happen...");
		return;
	}
	
	Local<Object> ret_obj = Object::New(isolate);
	ret_obj->Set(String::NewFromUtf8(isolate, "address"), String::NewFromUtf8(isolate, dest_addr));
	ret_obj->Set(String::NewFromUtf8(isolate, "family"),  String::NewFromUtf8(isolate, family_str));
	ret_obj->Set(String::NewFromUtf8(isolate, "port"),    Integer::New(isolate, htons(dest_port)));
	
	args.GetReturnValue().Set(ret_obj);
}

void Tproxy::debugCheckFD(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	int fd;
	int ret;
	int is_transparent = 0;
	int is_reusable = 0;
	int flags;
	socklen_t sa_size;
	
	if(!args[0]->IsNumber()) {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, "Error parameter (not a number!)"));
		return;
	}
	
	fd = args[0]->ToInteger()->Value();
	
	is_transparent = 1;
	sa_size = sizeof(is_transparent);
	ret = getsockopt(fd, SOL_IP, IP_TRANSPARENT, &is_transparent, &sa_size);
	if(ret == -1) {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, "Error on IP_TRANSPARENT"));
		return;
	}
	
	is_reusable = 1;
	sa_size = sizeof(is_reusable);
	ret = getsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &is_reusable, &sa_size);
	if(ret == -1) {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, "Error on SO_REUSEADDR"));
		return;
	}
	
	flags = fcntl(fd, F_GETFL, 0);
	if(flags == -1) {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, "Error on fcntl()"));
		return;
	}
	
	Local<Object> obj_ret;
	
	obj_ret = Object::New(isolate);
	obj_ret->Set(
		String::NewFromUtf8(isolate, "fd"),
		Number::New(isolate, fd)
	);
	obj_ret->Set(
		String::NewFromUtf8(isolate, "is_transparent"),
		Number::New(isolate, is_transparent)
	);
	obj_ret->Set(
		String::NewFromUtf8(isolate, "is_reusable"),
		Number::New(isolate, is_reusable)
	);
	obj_ret->Set(
		String::NewFromUtf8(isolate, "flags"),
		Number::New(isolate, flags)
	);
	
	args.GetReturnValue().Set(obj_ret);
}

int Tproxy::getIpType(const char *ip) {
	char address_buffer[sizeof(struct in6_addr)];
	
	if(uv_inet_pton(AF_INET, ip, &address_buffer) == 0) {
		return(4);
	}
	
	if(uv_inet_pton(AF_INET6, ip, &address_buffer) == 0) {
		return(6);
	}
	
	return(0);
}
