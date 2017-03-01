/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * Core base module [http://www.binarysec.com]
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

#include "utils.hh"
#include "nreg_wrap.hh"

using namespace v8;

void InitAll(Handle<Object> exports, Handle<Object> module) {
	CoreUtils::Init(exports);
	CoreNregWrap::Init(exports);
}

NODE_MODULE(core, InitAll)

