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

#ifndef _CORE_UTILS_H
#define _CORE_UTILS_H

#include <node.h>

class CoreUtils {
	public:
		static void Init(v8::Handle<v8::Object> exports);
		
	private:
		static void dateToStr(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void cstrrev(const v8::FunctionCallbackInfo<v8::Value>& args);
};

#endif
