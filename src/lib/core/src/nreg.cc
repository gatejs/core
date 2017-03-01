/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * CoreNreg main object [http://www.binarysec.com]
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

#include "nreg.hh"

#include <cstring>
#include <cstdio>

struct CoreNregSearch {
	CoreNregNode *node;
	
	/** \brief The current char ID */
	unsigned int id;
	
	/** \brief The current node ID. May be the char ID or a special char. -1 to stop. */
	unsigned int node_id;
	
	/** \brief The previous character matched */
	unsigned int prev_char;
	
	/** \brief References counter when a * is repeated */
	unsigned ref_count;
	
	/** \brief Is ref_count growing? */
	bool growing;
	
	CoreDlc link;
};

static CoreNregSearch *_nreg_search_new(
	CoreDlb *base,
	CoreNregNode *node,
	int id,
	int node_id,
	int prev_char,
	bool is_star = false
);

static bool _nreg_match_ending_stars(
	CoreNregTranslation *specials,
	CoreNregSearch *itm,
	int *match_count,
	CoreNregCallback cb,
	void *cb_data
);

static void _nreg_search_pop(CoreDlb *base);

static void _nreg_search_destroy(CoreDlb *base);


static CoreNregSearch *_nreg_search_new(
		CoreDlb *base,
		CoreNregNode *node,
		int id,
		int node_id,
		int prev_char,
		bool is_star
	) {
	CoreNregSearch *nnew;
	
	if(is_star) {
		CoreDlc *last;
		
		last = base->get_last();
		nnew = last->get_spec<CoreNregSearch>();
		nnew->ref_count++;
		
		nnew->id++;
		nnew->node_id = node_id;
		
		return(nnew);
	}
	
	nnew = new CoreNregSearch;
	
	nnew->growing = true;
	nnew->ref_count = 0;
	nnew->node = node;
	nnew->id = id;
	nnew->node_id = node_id;
	nnew->prev_char = prev_char;
	base->add_at_last(&nnew->link, nnew);
	
	return nnew;
}

static void _nreg_search_pop(CoreDlb *base) {
	CoreDlc *last;
	CoreNregSearch *data;
	
	last = base->get_last();
	if(last != NULL) {
		data = last->get_spec<CoreNregSearch>();
		if(data->ref_count == 0) {
			data->node->is_matched = false;
			last->remove();
			delete data;
		}
		else {
			data->growing = false;
			data->ref_count--;
			data->id--;
			data->node_id = data->prev_char + 1;
		}
	}
}

static void _nreg_search_destroy(CoreDlb *base) {
	CoreDlc *cur;
	CoreDlc *nxt;
	CoreNregSearch *search;
	
	cur = base->get_first();
	while(cur != NULL) {
		nxt = cur->get_next();
		search = cur->get_spec<CoreNregSearch>();
		
		search->node->is_matched = false;
		cur->remove();
		delete search;
		
		cur = nxt;
	}
}

void CoreNregPrelearn::pre_learn(std::string &expr_in) {
	bool is_escape = false;
	int id;
	std::string expr;
	const unsigned char *str;
	int size;
	
	str = reinterpret_cast<const unsigned char*>(expr_in.c_str());
	size = expr_in.size();
	
	this->learn_count += (size > 0 ? 1 : 0);
	
	for(int i = 0 ; i < size ; i++) {
		id = (unsigned) str[i];
		
		if(is_escape) {
			is_escape = false;
			
			if(id == NREG_CHAR_UNICODE2)
				id = NREG_NODE_UNICODE2;
			else if(id == NREG_CHAR_UNICODE3)
				id = NREG_NODE_UNICODE3;
			else if(id == NREG_CHAR_UNICODE4)
				id = NREG_NODE_UNICODE4;
		}
		else if(id == NREG_CHAR_ESCAPE) {
			is_escape = true;
			continue;
		}
		else if(id == NREG_CHAR_STAR) {
			id = NREG_NODE_STAR;
		}
		
		if(this->is_insensitive) {
			if((id >= 97 && id <= 122) || (id >= 65 && id <= 90)) {
				this->ttset[toupper(id)] = true;
				this->ttset[tolower(id)] = true;
				continue;
			}
		}
		
		this->ttset[id] = true;
	}
}

int CoreNregPrelearn::to_transtab(CoreNregTranslation *transtab, CoreNregTranslation *specials) {
	int ttcount;
	int i;
	
	ttcount = 0;
	for(i = 0 ; i < NREG_TT_SIZE ; i++) {
		if(i == NREG_NODE_STAR) {
			specials[NREG_SPEC_BEGIN] = ttcount;
		}
		
		if(this->ttset[i]) {
			if((i >= 97 && i <= 122) && this->is_insensitive) {
				transtab[i] = transtab[i - 32];
			}
			else {
				if(i >= NREG_NODE_STAR)
					specials[i - NREG_NODE_STAR + NREG_SPEC_STAR] = ttcount;
				
				transtab[i] = ttcount;
				ttcount++;
			}
		}
		else {
			if(i >= NREG_NODE_STAR)
				specials[i - NREG_NODE_STAR + NREG_SPEC_STAR] = NREG_OUT_OF_RANGE;
			
			transtab[i] = NREG_OUT_OF_RANGE;
		}
	}
	
	return(ttcount);
}

CoreNreg::CoreNreg(CoreNregPrelearn &prelearn) {
	this->transtab_count = prelearn.to_transtab(this->transtab, this->specials);
	this->first = new CoreNregNode(this->transtab_count);
}

CoreNreg::~CoreNreg() {
	CoreDlc *cur;
	CoreDlc *nxt;
	CoreNregNode *node;
	
	cur = this->node_list.get_first();
	while(cur) {
		node = cur->get_spec<CoreNregNode>();
		nxt = cur->get_next();
		
		delete node;
		
		cur = nxt;
	}
	
	delete this->first;
}

bool CoreNreg::insert(std::string &expr_in) {
	CoreNregNode *node = this->first;
	CoreNregNode *nnew = NULL;
	bool is_escape = false;
	size_t i;
	std::string expr;
	const unsigned char *expr_data;
	size_t expr_size;
	unsigned int id;
	
	expr_data = reinterpret_cast<const unsigned char*>(expr_in.c_str());
	expr_size = expr_in.size();
	
	for(i = 0 ; i < expr_size ; i++) {
		if(nnew == NULL) {
			nnew = new CoreNregNode(this->transtab_count);
			this->node_list.add_at_first(&nnew->glob_link, nnew);
		}
		
		if(is_escape) {
			is_escape = false;
			
			if(expr_data[i] == NREG_CHAR_UNICODE2)
				id = this->specials[NREG_SPEC_UNICODE2];
			else if(expr_data[i] == NREG_CHAR_UNICODE3)
				id = this->specials[NREG_SPEC_UNICODE3];
			else if(expr_data[i] == NREG_CHAR_UNICODE4)
				id = this->specials[NREG_SPEC_UNICODE4];
			else
				id = this->transtab[expr_data[i]];
		}
		else if(expr_data[i] == NREG_CHAR_ESCAPE) {
			is_escape = true;
			continue;
		}
		else if(expr_data[i] == NREG_CHAR_STAR) {
			id = this->specials[NREG_SPEC_STAR];
		}
		else {
			id = this->transtab[expr_data[i]];
		}
		
		if(id == NREG_OUT_OF_RANGE) {
			if(nnew != NULL) {
				nnew->glob_link.remove();
				delete nnew;
			}
			return(false);
		}
		
		if(node->chars[id]) {
			node = node->chars[id];
		}
		else {
			node->chars[id] = nnew;
			node = nnew;
			nnew = NULL;
		}
	}
	
	if(nnew != NULL) {
		nnew->glob_link.remove();
		delete nnew;
		return(false);
	}
	
	node->rule = expr_in;
	if(node->is_final == false) {
		node->is_final = true;
		return(true);
	}
	
	return(false);
}

/* Return the count of match, or -1 for an error */
int CoreNreg::match(
		const char *str,
		int size,
		CoreNregCallback cb,
		void *cb_data
	) {
	CoreDlb base;
	CoreNregSearch *itm;
	int match_count;
	unsigned char const *match;
	unsigned int match_size;
	int unival;
	bool ret;
	
	match      = reinterpret_cast<unsigned const char*>(str);
	match_size = size;
	
	itm = _nreg_search_new(&base, this->first, 0, this->translate(match[0]), NREG_OUT_OF_RANGE);
	match_count = 0;
	while(itm != NULL && match_count != -1) {
		CoreDlc *last;
		last = base.get_last();
		if(last != NULL) {
			itm = last->get_spec<CoreNregSearch>();
		}
		else {
			itm = NULL;
			continue;
		}
		
		/* If we have a last star at the end, and no chars. Ex: "c" matched by "c*" */
		if(itm->id >= match_size) {
			ret = _nreg_match_ending_stars(this->specials, itm, &match_count, cb, cb_data);
			if(ret == false) {
				_nreg_search_destroy(&base);
				return(match_count);
			}
		}
		if(itm->node->is_final == true) {
			if(itm->node->is_matched == false) {
				if(
					itm->id >= match_size || (
						itm->prev_char == this->specials[NREG_SPEC_STAR] &&
						this->have(NREG_SPEC_STAR)
					)
				) {
					ret = cb(itm->node, cb_data);
					
					itm->node->is_matched = true;
					match_count++;
					
					if(ret == false) {
						_nreg_search_destroy(&base);
						return(match_count);
					}
				}
			}
		}
		
		if(itm->id >= match_size) {
			_nreg_search_pop(&base);
			continue;
		}
		
		unival = CoreUtf8Verify(reinterpret_cast<const unsigned char*>(match + itm->id), match_size - itm->id);
		
		if(
				itm->node_id < this->specials[NREG_SPEC_BEGIN] &&
				itm->node->chars[itm->node_id] != NULL
			) {
			if(itm->id + 1 < match_size)
				_nreg_search_new(&base, itm->node->chars[itm->node_id], itm->id + 1, this->translate(match[itm->id + 1]), itm->node_id);
			else
				_nreg_search_new(&base, itm->node->chars[itm->node_id], itm->id + 1, this->translate(match[itm->id]), itm->node_id);
		}
		else if(
				itm->node_id < this->transtab_count &&
				itm->node_id == this->specials[NREG_SPEC_STAR] &&
				this->have(NREG_SPEC_STAR) &&
				itm->node->chars[itm->node_id] != NULL
			) {
			_nreg_search_new(&base, itm->node->chars[itm->node_id], itm->id, this->translate(match[itm->id]), itm->node_id);
		}
		else if(
				itm->node_id < this->transtab_count &&
				unival != NREG_UNICODE_LAST &&
				this->have(NREG_SPEC_UNICODE2 + (unival - NREG_UNICODE_2)) &&
				itm->node->chars[this->specials[NREG_SPEC_UNICODE2 + (unival - NREG_UNICODE_2)]] != NULL
			) {
			unival = unival - NREG_UNICODE_2 + 2;
			if(itm->id + unival < match_size)
				_nreg_search_new(&base, itm->node->chars[itm->node_id], itm->id + unival, this->translate(match[itm->id + unival]), itm->node_id);
			else
				_nreg_search_new(&base, itm->node->chars[itm->node_id], itm->id + unival, this->translate(match[itm->id]), itm->node_id);
		}
		else if(itm->node_id == this->transtab_count) {
			if(itm->prev_char == this->specials[NREG_SPEC_STAR] && this->have(NREG_SPEC_STAR)) {
				/** \todo Check why this code was here/why it was used. */
				//if(itm->node->is_matched == true) {
					//_nreg_search_pop(&base);
					//continue;
				//}
				
				if(itm->growing && itm->id + 1 < match_size) {
					_nreg_search_new(&base, itm->node, itm->id + 1, this->translate(match[itm->id + 1]), this->specials[NREG_SPEC_STAR], true);
					continue;
				}
				else {
					_nreg_search_pop(&base);
					continue;
				}
			}
		}
		else if(itm->node_id > this->transtab_count) {
			_nreg_search_pop(&base);
			continue;
		}
		
		if(itm->node_id < this->specials[NREG_SPEC_BEGIN])
			itm->node_id = this->specials[NREG_SPEC_BEGIN];
		else
			itm->node_id++;
	}
	
	_nreg_search_destroy(&base);
	
	return(match_count);
}

inline CoreNregTranslation CoreNreg::translate(unsigned int c) {
	CoreNregTranslation ret;
	
	ret = this->transtab[c];
	if(ret == NREG_OUT_OF_RANGE)
		ret = this->specials[NREG_SPEC_BEGIN];
	
	return(ret);
}

inline bool CoreNreg::have(int spec) {
	if(this->specials[spec] != NREG_OUT_OF_RANGE)
		return(true);
	return(false);
}

static bool _nreg_match_ending_stars(
		CoreNregTranslation *specials,
		CoreNregSearch *itm,
		int *match_count,
		CoreNregCallback cb,
		void *cb_data
	) {
	CoreNregNode *node = itm->node;
	bool ret;
	int star = specials[NREG_SPEC_STAR];
	
	if(star == NREG_OUT_OF_RANGE)
		return(true);
	
	while(node->chars[star]) {
		if(node->chars[star]->is_final == true) {
			ret = cb(node->chars[star], cb_data);
			
			(*match_count)++;
			
			if(ret == false)
				return(false);
		}
		node = node->chars[star];
	}
	
	return(true);
}

