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

#ifndef _NREG_H
#define _NREG_H


#include "lists.hh"
#include <string>
//To debug with printf/puts/...
#include <cstdio>

enum {
	NREG_NODE_STAR		= 256,
	NREG_NODE_UNICODE2	= 257,
	NREG_NODE_UNICODE3	= 258,
	NREG_NODE_UNICODE4	= 259,
	NREG_NODE_INVALID	= 260
};

enum {
	NREG_SPEC_BEGIN       = 0,
	NREG_SPEC_STAR        = 1,
	NREG_SPEC_UNICODE2    = 2,
	NREG_SPEC_UNICODE3    = 3,
	NREG_SPEC_UNICODE4    = 4,
	NREG_SPEC_INVALID     = 5,
};

enum {
	NREG_CHAR_ESCAPE	= '\\',
	NREG_CHAR_STAR		= '*',
	NREG_CHAR_UNICODE2	= '2',
	NREG_CHAR_UNICODE3	= '3',
	NREG_CHAR_UNICODE4	= '4',
	NREG_CHAR_LAST
};

#define NREG_OUT_OF_RANGE 0xFFFF
#define NREG_TT_SIZE      NREG_NODE_INVALID

typedef unsigned short CoreNregTranslation;

class CoreNregPrelearn {
	public:
		CoreNregPrelearn() : learn_count(0), is_insensitive(false) {
			for(int i = 0 ; i < NREG_TT_SIZE ; i++)
				this->ttset[i] = false;
		}
		
		void set_insensitive(bool isens) {
			if(learn_count == 0)
				this->is_insensitive = isens;
		}
		
		void pre_learn(std::string &expr_in);
		
		/** \brief Translate The learned informations into a transtab
		 * \param transtab The transtab to fill
		 * \param specials The special chars IDs informations table to fill
		 * \return The number of translated chars
		 */
		int to_transtab(CoreNregTranslation *transtab, CoreNregTranslation *specials);
		
	private:
		/** \brief Translation table for input chars (1=set, 0=unset). */
		bool ttset[NREG_TT_SIZE];
		
		/** \brief Learning counter */
		long learn_count;
		
		/** \brief Transtab maximum value */
		int ttmax;
		
		/** \brief Is the transtab insensitive? */
		bool is_insensitive;
};

struct CoreNregNode {
	CoreNregNode(int vec_cnt) : is_final(false), is_matched(false) {
		if(vec_cnt <= 0)
			vec_cnt = 1;
		this->chars = new CoreNregNode*[vec_cnt];
		memset(this->chars, 0, sizeof(*this->chars) * vec_cnt);
	}
	
	~CoreNregNode() {
		delete this->chars;
	}
	
	/** \brief Used chars */
	CoreNregNode **chars;
	
	/** \brief Is a final node? */
	bool is_final;
	
	/** \brief Pattern on this node (non null only if it matched) */
	std::string rule;
	
	/** \brief Has the node been matched? */
	bool is_matched;
	
	/** \brief Link between ALL nodes. For the free only. */
	CoreDlc glob_link;
};

/** \return false if we want to stop, or true else */
typedef bool (*CoreNregCallback)(CoreNregNode *node, void *usr);

class CoreNreg {
	public:
		CoreNreg(CoreNregPrelearn &prelearn);
		~CoreNreg();
		
		/** @return false on error (already in the list) or true else. */
		bool insert(std::string &expr_in);
		
		/** @return The count of match, or -1 for an error */
		int match(
			const char *str,
			int size,
			CoreNregCallback cb,
			void *cb_data
		);
		
	private:
		inline CoreNregTranslation translate(unsigned int c);
		
		inline bool have(int spec);
		
		/** \brief The first nodes in the nreg. Just used for the inner list. */
		CoreNregNode *first;
		
		/** \brief Translation table for input chars. */
		CoreNregTranslation transtab[NREG_TT_SIZE];
		
		/** \brief Special chars IDs */
		CoreNregTranslation specials[NREG_SPEC_INVALID];
		
		/** \brief Transtab maximum value + 1 */
		unsigned int transtab_count;
		
		/** \brief Every nodes are included except the first one, which must not be freed. */
		CoreDlb node_list;
		
		friend int _nreg_match_ending_stars();
};

#endif
