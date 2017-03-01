/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * CoreNreg unicode utilities [http://www.binarysec.com]
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

#ifndef _NREG_UNICODE_H
#define _NREG_UNICODE_H

#include <string>

enum CoreUnicodeIndex {
	NREG_UNICODE_2,
	NREG_UNICODE_3,
	NREG_UNICODE_4,
	NREG_UNICODE_LAST,
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Décodeur Unicode
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
int CoreUtf8Verify(
	const unsigned char *input, 
	int input_len
);

inline char _tranform(char c1, char c2);

inline int _is_valid_hexa(char c);

unsigned int CoreUtf8Decoder(
	std::string &input_s,
	std::string &output_s
);

#endif
