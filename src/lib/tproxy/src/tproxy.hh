#ifndef _H_TPROXY_TPROXY
#define _H_TPROXY_TPROXY

class Tproxy : public node::ObjectWrap {
	public:
		static void Init(v8::Handle<v8::Object> exports);
		
	private:
		static v8::Handle<v8::Value> setTproxyFD(const v8::Arguments& args);
		static v8::Handle<v8::Value> newTproxyFD(const v8::Arguments& args);
		static v8::Handle<v8::Value> newTproxyClientFD(const v8::Arguments& args);
		static v8::Handle<v8::Value> newTproxyServerFD(const v8::Arguments& args);
		static v8::Handle<v8::Value> getTproxyRealDest(const v8::Arguments& args);
		static v8::Handle<v8::Value> debugCheckFD(const v8::Arguments& args);
		
		static int getIpType(const char *ip);
};


#endif
