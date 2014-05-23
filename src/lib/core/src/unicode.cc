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

#include "unicode.hh"

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Décodeur Unicode
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
int CoreUtf8Verify(
		const unsigned char *input, 
		int input_len
	) {
	int ret = NREG_UNICODE_LAST;
	
	if(*input <= 0x7F)
		return(NREG_UNICODE_LAST);
	
	if((*input & 0xE0) == 0xC0) {
		if (input_len < 1) 
			ret = NREG_UNICODE_LAST;
		else {
			if (((*(input + 1)) & 0xC0) != 0x80)
				ret = NREG_UNICODE_LAST;
			else
				ret = NREG_UNICODE_2;
		}
	}
	else if((*input & 0xF0) == 0xE0) {
		if (input_len < 3) 
			ret = NREG_UNICODE_LAST;
		else {
			if (
				( ((*(input + 1)) & 0xC0) != 0x80 ) ||
				( ((*(input + 2)) & 0xC0) != 0x80 )
				)
				ret = NREG_UNICODE_LAST;
			else
				ret = NREG_UNICODE_3;
		}
	}
	else if((*input & 0xF8) == 0xF0) {
		if (input_len < 3) 
			ret = NREG_UNICODE_LAST;
		else {
			if (
				( ((*(input + 1)) & 0xC0) != 0x80 ) ||
				( ((*(input + 2)) & 0xC0) != 0x80 ) ||
				( ((*(input + 3)) & 0xC0) != 0x80 )
				)
				ret = NREG_UNICODE_LAST;
			else
				ret = NREG_UNICODE_4;
		}
	}
	
	return(ret);
}

unsigned int CoreUtf8Decoder(
		std::string &input_s,
		std::string &output_s
	) {
	unsigned int input_len = input_s.size();
	unsigned int output_len;
	char c1, c2;
	unsigned int i = 0;
	const char *str_in = input_s.c_str();
	
	output_len = 0;
	output_s.clear();
	
#define OUT_WRITE(a) \
	output_s += a; \
	output_len++;
	
	while (i < input_len) {
		if(str_in[i] == '%') {
			if((i + 2) < input_len) {
				c1 = str_in[i + 1];
				c2 = str_in[i + 2];
				if(_is_valid_hexa(c1) && _is_valid_hexa(c2)) {
					OUT_WRITE(_tranform(c1, c2));
					i += 3;
				}
				else {
					OUT_WRITE('%');
					OUT_WRITE(c1);
					OUT_WRITE(c2);
					i += 3;
				}
			}
			else {
				OUT_WRITE('%');
				i++;
				if (i < input_len) {
					OUT_WRITE(str_in[i]);
					i++;
				}
			}
		}
		else {
			OUT_WRITE(str_in[i]);
			i++;
		}
	}
	
	return(output_len);
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Routine de validation de valeur hexadécimale
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
inline int _is_valid_hexa(char c) {
	if(
		((c >= '0') && (c <= '9')) ||
		((c >= 'a') && (c <= 'f')) ||
		((c >= 'A') && (c <= 'F'))
		) {
		return(1);
	}
	return(0);
}

inline char _tranform(char c1, char c2) {
	char ret;

	ret = (c1 >= 'A' ? ((c1 & 0xdf) - 'A') + 10 : (c1 - '0'));
	ret *= 16;
	ret += (c2 >= 'A' ? ((c2 & 0xdf) - 'A') + 10 : (c2 - '0'));
		
	return(ret);
}
