/*
 * Copyright (c) 2010-2014 BinarySEC SAS
 * CoreNreg lists [http://www.binarysec.com]
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

#ifndef _NREG_LISTS_H
	#define _NREG_LISTS_H
	
	#include <cstring>
	
	#include "unicode.hh"
	
	class CoreDlb;
	
	struct CoreDlc {
		public:
			inline CoreDlc() : base(NULL), next(NULL), prev(NULL), spec(NULL) {
			}
			
			inline CoreDlc *get_next() {
				if(this->next != NULL)
					return(this->next);
				return(NULL);
			}
			
			inline CoreDlc *get_prev() {
				if(this->prev != NULL)
					return(this->prev);
				return(NULL);
			}
			
			template <typename T> inline T *get_spec() {
				if(this->spec != NULL)
					return(static_cast<T*>(this->spec));
				return(NULL);
			}
			
			inline void *get_base() {
				if(this->base != NULL)
					return(this->base);
				return(NULL);
			}
			
			inline void remove();
			
		private:
			CoreDlb *base;
			CoreDlc *next;
			CoreDlc *prev;
			void *spec;
		
		friend class CoreDlb;
	};
	
	class CoreDlb {
		public:
			inline CoreDlb() : counter(0), first(NULL), last(NULL) {
			}
			
			inline void CoreDlb_fini(CoreDlb *base) {
				base->first = NULL;
				base->last = NULL;
			}
			
			/** \brief Add an element to the first position in list */
			inline void add_at_first(
					CoreDlc *chain,
					void *spec
				) {
				CoreDlc *_first = NULL;
				
				memset(chain, 0, sizeof(CoreDlc));
				
				/* ajoute le pointeur spec dans la chaine */
				chain->spec = spec;
				
				/* enregistre le pointeur de base */
				chain->base = this;
				
				/* enregistre le premier element */
				_first = this->first;
				
				/* Indique le le first c'est cette chaine en cours */
				this->first = chain;
				
				/* Si le premier element est non null alors le prev 
				   de l'ancienne premier pointe sur la chaine en cour 
				   et le pointeur next de la chaine en cours pointe 
				   sur le premier */
				if(_first != NULL) {
					_first->prev = chain;
					chain->next = _first;
				}
				/* Si first est NULL cela veux aussi dire que last 
				   l'est. Donc last doit pointer sur la chaine en cours */
				else {
					this->last = chain;
				}
				
				/* increase counter */
				this->counter++;
			}
			
			/** 
			 * Ajoute un element chain en derniere position de la list
			 **/
			inline void add_at_last(
					CoreDlc *chain,
					void *spec
				) {
				CoreDlc *_last = NULL;
				
				memset(chain, 0, sizeof(CoreDlc));
				
				/* ajoute le pointeur spec dans la chaine */
				chain->spec = spec;
				
				/* enregistre le pointeur de base */
				chain->base = this;
				
				/* enregistre le premier element */
				_last = this->last;
				
				/* Indique le last c'est cette chaine en cours */
				this->last = chain;
				
				if(_last != NULL) {
					_last->next = chain;
					chain->prev = _last;
				}
				else {
					this->first = chain;
				}
				
				/* increase counter */
				this->counter++;
			}
			
			inline CoreDlc *get_first() {
				if(this->first != NULL)
					return(this->first);
				return(NULL);
			}
			
			inline CoreDlc *get_last() {
				if(this->last != NULL)
					return(this->last);
				return(NULL);
			}
			
			inline int get_counter() {
				return(this->counter);
			}
			
		private:
			/** \brief Number of element */
			unsigned int counter;
			
			/** \brief First element */
			CoreDlc *first;
			
			/** \brief Last element */
			CoreDlc *last;
			
		friend class CoreDlc;
	};
	
	
	/** 
	 * Supprime les liaisons DL sans lancer le vecteur de destruction
	 **/
	inline void CoreDlc::remove() {
		if(this->next != NULL) {
			if(this->prev != NULL)
				this->next->prev = this->prev;
			else
				this->next->prev = NULL;
		}
		
		if(this->prev != NULL) {
			if(this->next != NULL)
				this->prev->next = this->next;
			else
				this->prev->next = NULL;
		}
		
		if(this->base) {
			if(this->base->last == this) {
				if(this->prev != NULL)
					this->base->last = this->prev;
				else
					this->base->last = NULL;
			}
			
			if(this->base->first == this) {
				if(this->next != NULL)
					this->base->first = this->next;
				else
					this->base->first = NULL;
			}
			
			/* decrease counter */
			this->base->counter--;
		}
	}
	
#endif
