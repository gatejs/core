/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Javascript interface for the nreg object [http://www.binarysec.com]
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

#ifndef _NREG_WRAP_H
#define _NREG_WRAP_H

#include "nreg.hh"

#include <node_object_wrap.h>

#include <set>

#define NREG_DEFAULT_IS_INSENS    true

struct CoreNregWrapExpr {
	CoreNregWrapExpr() {}
	CoreNregWrapExpr(const char *str, int size) :
		expr(str, size) {};
	
	std::string expr;
	
	bool is_encoded;
	
	inline bool operator<(const CoreNregWrapExpr &expr2) const {
		return(this->expr < expr2.expr);
	}
};

class CoreNregWrap : public node::ObjectWrap {
	public:
		static void Init(v8::Handle<v8::Object> exports);
		static void NewInstance(const v8::FunctionCallbackInfo<v8::Value>& args);
		
		bool obj_match(const char *str, int size, CoreNregWrapExpr *expr);
		int obj_match_all(const char *str, int size, std::set<CoreNregWrapExpr> *exprs);
		void obj_add(const char *str, int size);
		void obj_reload();
	
	private:
		CoreNregWrap(bool insens);
		~CoreNregWrap();
		
		static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void set(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void add(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void del(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void getObj(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void reload(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void match(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void matchAll(const v8::FunctionCallbackInfo<v8::Value>& args);
		static bool match_cb(CoreNregNode *node, void *usr);
		static bool match_all_cb(CoreNregNode *node, void *usr);
		
		static int default_expr_count;
		
		static v8::Persistent<v8::Function> constructor;
		
		std::set<CoreNregWrapExpr> exprs;
		CoreNreg *nreg;
		bool is_insensitive;
};

#endif
