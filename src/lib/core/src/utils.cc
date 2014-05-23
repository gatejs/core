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

#include <ctime>
#include <string>

using namespace v8;

void CoreUtils::Init(Handle<Object> exports) {
	exports->Set(String::NewSymbol("dateToStr"),
      FunctionTemplate::New(dateToStr)->GetFunction());
}

v8::Handle<v8::Value> CoreUtils::dateToStr(const v8::Arguments& args) {
	HandleScope scope;
	Local<Number> jsnum;
	std::string fmt = "%d/%b/%Y:%H:%M:%S %z";
	time_t unix_ts = time(NULL);
	struct tm toConvert;
	int ret;
	
	char buffer[1024];
	
	if (args.Length() == 1 || args.Length() == 2) {
		if(args.Length() == 1) {
			if(args[0]->IsNumber()) {
				double tstamp = args[0]->ToNumber()->Value();
				unix_ts = tstamp / 1000;
			}
			else if(args[0]->IsString()) {
				
				String::AsciiValue tmp(args[0]->ToString());
				fmt = *tmp;
			}
		}
		else {
			if(args[0]->IsNumber() && args[1]->IsString()) {
				double tstamp = args[0]->ToNumber()->Value();
				String::AsciiValue tmp(args[1]->ToString());
				
				unix_ts = tstamp / 1000;
				fmt = *tmp;
			}
		}
	}
	
	gmtime_r(&unix_ts, &toConvert);
	ret = strftime(buffer, sizeof(buffer) - 1, fmt.c_str(), &toConvert);
	if(ret <= 0) {
		return(scope.Close(Undefined()));
	}
	
	return(scope.Close(String::New(buffer)));
}
