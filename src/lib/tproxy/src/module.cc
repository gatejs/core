#include "module.hh"

using namespace v8;

void InitAll(Handle<Object> exports, Handle<Object> module) {
	Tproxy::Init(exports);
}

NODE_MODULE(tproxy, InitAll)

