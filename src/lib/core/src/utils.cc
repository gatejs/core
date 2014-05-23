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
