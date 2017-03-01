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

#include <node.h>
#include "nreg_wrap.hh"
#include "node_v8_macros.hh"

#include <set>
#include <algorithm>

using namespace v8;

Persistent<Function> CoreNregWrap::constructor;
int CoreNregWrap::default_expr_count;

//DEBUG
CoreNregWrap::CoreNregWrap(bool insens) : is_insensitive(insens) {
	this->nreg = NULL;
}
CoreNregWrap::~CoreNregWrap() {
	delete this->nreg;
}

void CoreNregWrap::Init(Handle<Object> exports) {
	Isolate* isolate = Isolate::GetCurrent();
	// Prepare constructor template
	Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
	tpl->SetClassName(String::NewFromUtf8(isolate, "nreg"));
	tpl->InstanceTemplate()->SetInternalFieldCount(1);
	
	// Prototype
#define SETFUNC(_name_) \
	NODE_SET_PROTOTYPE_METHOD(tpl, #_name_, _name_);
	SETFUNC(set)
	SETFUNC(add)
	SETFUNC(del)
	SETFUNC(getObj)
	SETFUNC(reload)
	SETFUNC(match)
	SETFUNC(matchAll)
#undef SETFUNC
	
	constructor.Reset(isolate, tpl->GetFunction());
	
	NODE_SET_METHOD(exports, "nreg", NewInstance);
}

void CoreNregWrap::NewInstance(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	
	Local<Object> instance;
	
	if(args.Length() == 1) {
		Handle<Value> argv[1] = { args[0] };
		Local<Function> cons = Local<Function>::New(isolate, constructor);
		instance = NVM_NEW_INSTANCE(cons, isolate, 1, argv);
	}
	else {
		Handle<Value> argv[0] = { };
		Local<Function> cons = Local<Function>::New(isolate, constructor);
		instance = NVM_NEW_INSTANCE(cons, isolate, 0, argv);
	}
	
	args.GetReturnValue().Set(instance);
}

void CoreNregWrap::New(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj;
	Local<Object> mainobj;
	Local<Value> value;
	bool is_insensitive;
	std::string expr;
	
	if(args.Length() != 1) {
		obj = new CoreNregWrap(true);
		
		obj->obj_reload();
		
		obj->Wrap(args.This());
		args.GetReturnValue().Set(args.This());
		return;
	}
	
	if(args[0]->IsBoolean()) {
		obj = new CoreNregWrap(args[0]->ToBoolean()->Value());
		
		obj->obj_reload();
		
		obj->Wrap(args.This());
		args.GetReturnValue().Set(args.This());
		return;
	}
	else if(!args[0]->IsObject()) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type (argument 1)")));
		return;
	}
	
	mainobj = args[0]->ToObject();
	value = mainobj->Get(String::NewFromUtf8(isolate, "is_insensitive"));
	if(!value->IsBoolean()) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type (is_insensitive)")));
		return;
	}
	is_insensitive = value->ToBoolean()->Value();
	
	obj = new CoreNregWrap(is_insensitive);
	
	value = mainobj->Get(String::NewFromUtf8(isolate, "expressions"));
	if(!value->IsArray()) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type (expressions)")));
		return;
	}
	
	Local<Array> fields = value.As<Array>();
	for (unsigned int i = 0, limiti = fields->Length(); i < limiti; i++) {
		if(!fields->Get(i)->IsString())
			continue;
		Local<String> argstr = fields->Get(i)->ToString();
		String::Utf8Value tmp(argstr->ToString());
		expr = std::string(*tmp, tmp.length());
		if(obj->is_insensitive)
			std::transform(expr.begin(), expr.end(), expr.begin(), ::tolower);
		obj->obj_add(expr.c_str(), expr.length());
	}
	
	obj->obj_reload();
	
	obj->Wrap(args.This());
	args.GetReturnValue().Set(args.This());
}

void CoreNregWrap::set(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	Local<Object> mainobj;
	Local<Value> value;
	bool is_insensitive;
	std::string expr;
	
	if (args.Length() != 1) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
		return;
	}
	
	if(!args[0]->IsObject()) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type (argument 1)")));
		return;
	}
	
	obj->exprs = std::set<CoreNregWrapExpr>();
	
	mainobj = args[0]->ToObject();
	value = mainobj->Get(String::NewFromUtf8(isolate, "is_insensitive"));
	if(!value->IsBoolean()) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type (is_insensitive)")));
		return;
	}
	is_insensitive = value->ToBoolean()->Value();
	
	obj->is_insensitive = is_insensitive;
	
	value = mainobj->Get(String::NewFromUtf8(isolate, "expressions"));
	if(!value->IsArray()) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type (expressions)")));
		return;
	}
	
	Local<Array> fields = value.As<Array>();
	for (unsigned int i = 0, limiti = fields->Length(); i < limiti; i++) {
		if(!fields->Get(i)->IsString())
			continue;
		Local<String> argstr = fields->Get(i)->ToString();
		String::Utf8Value tmp(argstr->ToString());
		expr = std::string(*tmp, tmp.length());
		if(obj->is_insensitive)
			std::transform(expr.begin(), expr.end(), expr.begin(), ::tolower);
		obj->obj_add(expr.c_str(), expr.length());
	}
	
	delete obj->nreg;
	obj->nreg = NULL;
	
	obj->obj_reload();
	
	args.GetReturnValue().Set(args.This());
}

void CoreNregWrap::add(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	std::string expr;
	
	if (args.Length() < 1) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
		return;
	}
	
	for(int i = 0 ; i < args.Length() ; i++) {
		if(!args[i]->IsString()) {
			isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type")));
			return;
		}
		
		String::Utf8Value tmp(args[i]->ToString());
		expr = std::string(*tmp, tmp.length());
		if(obj->is_insensitive)
			std::transform(expr.begin(), expr.end(), expr.begin(), ::tolower);
		obj->obj_add(expr.c_str(), expr.length());
	}
	
	args.GetReturnValue().Set(args.This());
}

void CoreNregWrap::del(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	
	if (args.Length() < 1) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
		return;
	}
	
	for(int i = 0 ; i < args.Length() ; i++) {
		if(!args[i]->IsString()) {
			isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong argument type")));
			return;
		}
		
		String::Utf8Value tmp(args[i]->ToString());
		CoreNregWrapExpr nwe(*tmp, tmp.length());
		
		obj->exprs.erase(nwe);
	}
	
	args.GetReturnValue().Set(args.This());
}

void CoreNregWrap::getObj(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	Local<Object> ret;
	
	ret = Object::New(isolate);
	ret->Set(String::NewFromUtf8(isolate, "is_insensitive"), Boolean::New(isolate, obj->is_insensitive));
	
	std::set<CoreNregWrapExpr>::iterator itr = obj->exprs.begin();
	Local<Array> ret_arr = Array::New(isolate, obj->exprs.size());
	Local<Object> ins_obj;
	Local<Value> val;
	
	for(unsigned long i = 0; itr != obj->exprs.end(); itr++, i++) {
		CoreNregWrapExpr expr = (*itr);
		ret_arr->Set(i, String::NewFromUtf8(isolate, expr.expr.c_str()));
	}
	
	ret->Set(String::NewFromUtf8(isolate, "expressions"), ret_arr);
	
	args.GetReturnValue().Set(ret);
}

void CoreNregWrap::reload(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	
	obj->obj_reload();
	
	args.GetReturnValue().Set(args.This());
}

void CoreNregWrap::match(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	std::string decoded;
	std::string encoded;
	CoreNregWrapExpr expr;
	bool ret;
	
	if (args.Length() != 1) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
		return;
	}
	
	String::Utf8Value tmp(args[0]->ToString());
	
	encoded = std::string(*tmp, tmp.length());
	ret = obj->obj_match(encoded.c_str(), encoded.length(), &expr);
	
	if(ret) {
		args.GetReturnValue().Set(String::NewFromUtf8(isolate, expr.expr.c_str()));
		return;
	}
	
	args.GetReturnValue().Set(Boolean::New(isolate, false));
}

void CoreNregWrap::matchAll(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope(isolate);
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.Holder());
	int ret;
	std::string decoded;
	std::string encoded;
	Local<Array> ret_arr = Array::New(isolate);
	std::set<CoreNregWrapExpr> exprs;
	
	if (args.Length() != 1) {
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
		return;
	}
	
	String::Utf8Value tmp(args[0]->ToString());
	
	encoded = std::string(*tmp, tmp.length());
	ret = obj->obj_match_all(encoded.c_str(), encoded.length(), &exprs);
	
	if(ret > 0) {
		std::set<CoreNregWrapExpr>::iterator itr = obj->exprs.begin();
		
		for(unsigned long i = 0; itr != exprs.end(); itr++, i++) {
			CoreNregWrapExpr expr = (*itr);
			ret_arr->Set(i, String::NewFromUtf8(isolate, expr.expr.c_str()));
		}
	}
	
	args.GetReturnValue().Set(ret_arr);
}

bool CoreNregWrap::match_cb(CoreNregNode *node, void *usr) {
	CoreNregWrapExpr *expr = static_cast<CoreNregWrapExpr*>(usr);
	expr->expr = node->rule;
	return(false);
}

bool CoreNregWrap::match_all_cb(CoreNregNode *node, void *usr) {
	std::set<CoreNregWrapExpr> *match_set = static_cast<std::set<CoreNregWrapExpr>*>(usr);
	CoreNregWrapExpr expr;
	expr.expr = node->rule;
	
	match_set->insert(expr);
	
	return(true);
}

void CoreNregWrap::obj_add(const char *str, int size) {
	CoreNregWrapExpr expr(str, size);
	
	this->exprs.insert(expr);
}

void CoreNregWrap::obj_reload() {
	CoreNregWrapExpr expr;
	CoreNregPrelearn prelearn;
	std::set<CoreNregWrapExpr>::iterator itr;
	
	prelearn.set_insensitive(this->is_insensitive);
	
	for(itr = this->exprs.begin() ; itr != this->exprs.end(); itr++) {
		expr = *itr;
		prelearn.pre_learn(expr.expr);
	}
	
	if(this->nreg)
		delete this->nreg;
	this->nreg = new CoreNreg(prelearn);
	
	for(itr = this->exprs.begin() ; itr != this->exprs.end(); itr++) {
		expr = *itr;
		this->nreg->insert(expr.expr);
	}
}

bool CoreNregWrap::obj_match(const char *str, int size, CoreNregWrapExpr *expr) {
	int ret = this->nreg->match(
		str,
		size,
		CoreNregWrap::match_cb,
		expr
	);
	
	if(ret > 0)
		return(true);
	return(false);
}

int CoreNregWrap::obj_match_all(const char *str, int size, std::set<CoreNregWrapExpr> *exprs) {
	int ret = this->nreg->match(
		str,
		size,
		CoreNregWrap::match_all_cb,
		exprs
	);
	
	return(ret);
}
