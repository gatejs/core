/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core utilities [http://www.binarysec.com]
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

#include <node.h>
#include "utils.hh"
#include "node_v8_macros.hh"

#include <ctime>
#include <string>

using namespace v8;

void CoreUtils::Init(Handle<Object> exports) {
	NODE_SET_METHOD(exports, "dateToStr", dateToStr);
	NODE_SET_METHOD(exports, "cstrrev", cstrrev);
}

void CoreUtils::dateToStr(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	Local<Number> jsnum;
	std::string fmt = "%d/%b/%Y:%H:%M:%S %z";
	time_t unix_ts = time(NULL);
	struct tm toConvert;
	int ret;
	
	char buffer[1024];
	
	if (args.Length() == 1 || args.Length() == 2) {
		if(args.Length() == 1) {
			if(args[0]->IsNumber()) {
				double tstamp = NVM_TO_NUMBER_DOUBLE(args[0], isolate);
				unix_ts = tstamp / 1000;
			}
			else if(args[0]->IsString()) {
				
				String::Utf8Value tmp(args[0]->ToString());
				fmt = *tmp;
			}
		}
		else {
			if(args[0]->IsNumber() && args[1]->IsString()) {
				double tstamp = NVM_TO_NUMBER_DOUBLE(args[0], isolate);
				String::Utf8Value tmp(args[1]->ToString());
				
				unix_ts = tstamp / 1000;
				fmt = *tmp;
			}
		}
	}
	
	gmtime_r(&unix_ts, &toConvert);
	ret = strftime(buffer, sizeof(buffer) - 1, fmt.c_str(), &toConvert);
	if(ret <= 0) {
		args.GetReturnValue().Set(Undefined(isolate));
	}
	else {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, buffer));
	}
}

void CoreUtils::cstrrev(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	Local<String> input;
	char *input_c;
	char *buffer;
	
	input = args[0]->ToString();
	String::Utf8Value tmp(input);
	
	if(tmp.length() == 0) {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, ""));
		return;
	}
	
	input_c = *tmp;
	buffer = new char[tmp.length() + 1];
	for(int i = 0, l = tmp.length() ; i < l ; i++)
		buffer[l - i - 1] = input_c[i];
	
	buffer[tmp.length()] = '\0';
	input = String::NewFromUtf8(isolate, buffer);
	delete[] buffer;
	
	args.GetReturnValue().Set(input);
}
