#ifndef _BWS_UTILS_H
#define _BWS_UTILS_H

#include <node.h>

class CoreUtils {
	public:
		static void Init(v8::Handle<v8::Object> exports);
		
	private:
		static v8::Handle<v8::Value> dateToStr(const v8::Arguments& args);
};

#endif
