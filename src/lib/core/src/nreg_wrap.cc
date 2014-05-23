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
	// Prepare constructor template
	Local<FunctionTemplate> tpl = FunctionTemplate::New(New);
	tpl->SetClassName(String::NewSymbol("nreg"));
	tpl->InstanceTemplate()->SetInternalFieldCount(1);
	
	// Prototype
#define SETFUNC(_name_) \
	tpl->PrototypeTemplate()->Set( \
		String::NewSymbol(#_name_), \
		FunctionTemplate::New(_name_)->GetFunction() \
	);
	SETFUNC(set)
	SETFUNC(add)
	SETFUNC(del)
	SETFUNC(getObj)
	SETFUNC(reload)
	SETFUNC(match)
	SETFUNC(matchAll)
#undef SETFUNC
	
	CoreNregWrap::constructor = Persistent<Function>::New(tpl->GetFunction());
	exports->Set(String::NewSymbol("nreg"), CoreNregWrap::constructor);
}

Handle<Value> CoreNregWrap::NewInstance(int argc, Handle<Value> argv[]) {
	HandleScope scope;
	Handle<Value> obj = CoreNregWrap::constructor->NewInstance(argc, argv);
	
	return scope.Close(obj);
}

Handle<Value> CoreNregWrap::New(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj;
	Local<Object> mainobj;
	Local<Value> value;
	bool is_insensitive;
	bool is_encoded;
	std::string expr;
	
	if (args.Length() != 1) {
		obj = new CoreNregWrap(true);
		
		obj->obj_reload();
		
		obj->Wrap(args.This());
		return(args.This());
	}
	
	if(args[0]->IsBoolean()) {
		obj = new CoreNregWrap(args[0]->ToBoolean()->Value());
		
		obj->obj_reload();
		
		obj->Wrap(args.This());
		return(args.This());
	}
	else if(!args[0]->IsObject()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (argument 1)")));
		return scope.Close(Undefined());
	}
	
	mainobj = args[0]->ToObject();
	value = mainobj->Get(String::New("is_insensitive"));
	if(!value->IsBoolean()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (is_insensitive)")));
		return scope.Close(Undefined());
	}
	is_insensitive = value->ToBoolean()->Value();
	
	obj = new CoreNregWrap(is_insensitive);
	
	value = mainobj->Get(String::New("expressions"));
	if(!value->IsArray()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (expressions)")));
		return scope.Close(Undefined());
	}
	
	Local<Array> fields = Array::Cast(*value);
	for (unsigned int i = 0, limiti = fields->Length(); i < limiti; i++) {
		if(!fields->Get(i)->IsObject())
			continue;
		Local<Object> argobj = fields->Get(i)->ToObject();
		value = argobj->Get(String::New("expr"));
		if(!value->IsString())
			continue;
		String::AsciiValue tmp(value->ToString());
		value = argobj->Get(String::New("is_encoded"));
		if(!value->IsBoolean())
			is_encoded = false;
		else
			is_encoded = value->ToBoolean()->Value();
		expr = std::string(*tmp, tmp.length());
		if(obj->is_insensitive)
			std::transform(expr.begin(), expr.end(), expr.begin(), ::tolower);
		obj->obj_add(expr.c_str(), expr.length(), is_encoded);
	}
	
	obj->obj_reload();
	
	obj->Wrap(args.This());
	return(args.This());
}

Handle<Value> CoreNregWrap::set(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	Local<Object> mainobj;
	Local<Value> value;
	bool is_insensitive;
	bool is_encoded;
	std::string expr;
	
	if (args.Length() != 1) {
		ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
		return scope.Close(Undefined());
	}
	
	if(!args[0]->IsObject()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (argument 1)")));
		return scope.Close(Undefined());
	}
	
	obj->exprs = std::set<CoreNregWrapExpr>();
	
	mainobj = args[0]->ToObject();
	value = mainobj->Get(String::New("is_insensitive"));
	if(!value->IsBoolean()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (is_insensitive)")));
		return scope.Close(Undefined());
	}
	is_insensitive = value->ToBoolean()->Value();
	
	obj->is_insensitive = is_insensitive;
	
	value = mainobj->Get(String::New("expressions"));
	if(!value->IsArray()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (expressions)")));
		return scope.Close(Undefined());
	}
	
	Local<Array> fields = Array::Cast(*value);
	for (unsigned int i = 0, limiti = fields->Length(); i < limiti; i++) {
		if(!fields->Get(i)->IsObject())
			continue;
		Local<Object> argobj = fields->Get(i)->ToObject();
		value = argobj->Get(String::New("expr"));
		if(!value->IsString())
			continue;
		String::AsciiValue tmp(value->ToString());
		value = argobj->Get(String::New("is_encoded"));
		if(!value->IsBoolean())
			is_encoded = false;
		else
			is_encoded = value->ToBoolean()->Value();
		expr = std::string(*tmp, tmp.length());
		if(obj->is_insensitive)
			std::transform(expr.begin(), expr.end(), expr.begin(), ::tolower);
		obj->obj_add(expr.c_str(), expr.length(), is_encoded);
	}
	
	delete obj->nreg;
	obj->nreg = NULL;
	
	obj->obj_reload();
	
	//obj->Wrap(args.This());
	return(args.This());
}

Handle<Value> CoreNregWrap::add(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	bool is_encoded;
	std::string expr;
	
	if (args.Length() < 1) {
		ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
		return scope.Close(Undefined());
	}
	
	if(!args[0]->IsString()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (argument 1)")));
		return scope.Close(Undefined());
	}
	
	is_encoded = false;
	if(args.Length() >= 2) {
		if(!args[1]->IsBoolean()) {
			ThrowException(Exception::TypeError(String::New("Wrong argument type (argument 1)")));
			return scope.Close(Undefined());
		}
		is_encoded = args[1]->ToBoolean()->Value();
	}
	
	String::AsciiValue tmp(args[0]->ToString());
	expr = std::string(*tmp, tmp.length());
	if(obj->is_insensitive)
		std::transform(expr.begin(), expr.end(), expr.begin(), ::tolower);
	obj->obj_add(expr.c_str(), expr.length(), is_encoded);
	
	return(args.This());
}

Handle<Value> CoreNregWrap::del(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	bool is_encoded;
	
	if (args.Length() < 1) {
		ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
		return scope.Close(Undefined());
	}
	
	if(!args[0]->IsString()) {
		ThrowException(Exception::TypeError(String::New("Wrong argument type (argument 1)")));
		return scope.Close(Undefined());
	}
	
	is_encoded = false;
	if(args.Length() >= 2) {
		if(!args[1]->IsBoolean()) {
			ThrowException(Exception::TypeError(String::New("Wrong argument type (argument 1)")));
			return scope.Close(Undefined());
		}
		is_encoded = args[1]->ToBoolean()->Value();
	}
	
	String::AsciiValue tmp(args[0]->ToString());
	CoreNregWrapExpr nwe(*tmp, tmp.length(), is_encoded);
	
	obj->exprs.erase(nwe);
	
	return(args.This());
}

Handle<Value> CoreNregWrap::getObj(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	Local<Object> ret;
	
	ret = Object::New();
	ret->Set(String::New("is_insensitive"), Boolean::New(obj->is_insensitive));
	
	std::set<CoreNregWrapExpr>::iterator itr = obj->exprs.begin();
	Local<Array> ret_arr = Array::New(obj->exprs.size());
	Local<Object> ins_obj;
	Local<Value> val;
	
	for(unsigned long i = 0; itr != obj->exprs.end(); itr++, i++) {
		CoreNregWrapExpr expr = (*itr);
		ins_obj = Object::New();
		ins_obj->Set(String::New("expr"), String::New(expr.expr.c_str()));
		ins_obj->Set(String::New("is_encoded"), Boolean::New(expr.is_encoded));
		ret_arr->Set(i, ins_obj);
	}
	
	ret->Set(String::New("expressions"), ret_arr);
	
	return(scope.Close(ret));
}

Handle<Value> CoreNregWrap::reload(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	
	obj->obj_reload();
	
	return(scope.Close(args.This()));
}

Handle<Value> CoreNregWrap::match(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	std::string decoded;
	std::string encoded;
	CoreNregWrapExpr expr;
	bool ret;
	Local<Object> ret_obj = Object::New();
	
	if (args.Length() != 1) {
		ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
		return scope.Close(Undefined());
	}
	
	String::AsciiValue tmp(args[0]->ToString());
	
	encoded = std::string(*tmp, tmp.length());
	ret = obj->obj_match(encoded.c_str(), encoded.length(), &expr);
	
	if(ret) {
		ret_obj->Set(
			String::New("expr"),
			String::New(expr.expr.c_str())
		);
		
		ret_obj->Set(
			String::New("is_encoded"),
			Boolean::New(expr.is_encoded)
		);
		
		return(scope.Close(ret_obj));
	}
	
	return(scope.Close(Boolean::New(false)));
}

Handle<Value> CoreNregWrap::matchAll(const Arguments& args) {
	HandleScope scope;
	CoreNregWrap* obj = ObjectWrap::Unwrap<CoreNregWrap>(args.This());
	int ret;
	std::string decoded;
	std::string encoded;
	Local<Array> ret_arr = Array::New();
	std::set<CoreNregWrapExpr> exprs;
	
	if (args.Length() != 1) {
		ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
		return scope.Close(Undefined());
	}
	
	String::AsciiValue tmp(args[0]->ToString());
	
	encoded = std::string(*tmp, tmp.length());
	ret = obj->obj_match_all(encoded.c_str(), encoded.length(), &exprs);
	
	if(ret > 0) {
		std::set<CoreNregWrapExpr>::iterator itr = obj->exprs.begin();
		
		for(unsigned long i = 0; itr != exprs.end(); itr++, i++) {
			CoreNregWrapExpr expr = (*itr);
			Local<Object> ins_obj = Object::New();
			ins_obj->Set(String::New("expr"), String::New(expr.expr.c_str()));
			ins_obj->Set(String::New("is_encoded"), Boolean::New(expr.is_encoded));
			ret_arr->Set(i, ins_obj);
		}
	}
	
	return(scope.Close(ret_arr));
}

bool CoreNregWrap::match_cb(CoreNregNode *node, void *usr) {
	CoreNregWrapExpr *expr = static_cast<CoreNregWrapExpr*>(usr);
	expr->expr = node->rule;
	expr->is_encoded = node->is_encoded;
	return(false);
}

bool CoreNregWrap::match_all_cb(CoreNregNode *node, void *usr) {
	std::set<CoreNregWrapExpr> *match_set = static_cast<std::set<CoreNregWrapExpr>*>(usr);
	CoreNregWrapExpr expr;
	expr.expr = node->rule;
	expr.is_encoded = node->is_encoded;
	
	match_set->insert(expr);
	
	return(true);
}

void CoreNregWrap::obj_add(const char *str, int size, bool is_encoded) {
	CoreNregWrapExpr expr(str, size, is_encoded);
	
	this->exprs.insert(expr);
}

void CoreNregWrap::obj_reload() {
	CoreNregWrapExpr expr;
	CoreNregPrelearn prelearn;
	std::set<CoreNregWrapExpr>::iterator itr;
	
	prelearn.set_insensitive(this->is_insensitive);
	
	for(itr = this->exprs.begin() ; itr != this->exprs.end(); itr++) {
		expr = *itr;
		prelearn.pre_learn(expr.expr, expr.is_encoded);
	}
	
	if(this->nreg)
		delete this->nreg;
	this->nreg = new CoreNreg(prelearn);
	
	for(itr = this->exprs.begin() ; itr != this->exprs.end(); itr++) {
		expr = *itr;
		this->nreg->insert(expr.expr, expr.is_encoded);
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
