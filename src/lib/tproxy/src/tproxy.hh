/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Tproxy module sources header [http://www.binarysec.com]
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

#ifndef _H_TPROXY_TPROXY
#define _H_TPROXY_TPROXY

class Tproxy : public node::ObjectWrap {
	public:
		static void Init(v8::Handle<v8::Object> module);
		
	private:
		static void setTproxyFD(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void newTproxyFD(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void newTproxyClientFD(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void newTproxyServerFD(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void getTproxyRealDest(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void debugCheckFD(const v8::FunctionCallbackInfo<v8::Value>& args);
		
		static int getIpType(const char *ip);
};


#endif
