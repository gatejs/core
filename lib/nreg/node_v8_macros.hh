#ifndef _CORE_NODE_V8_MACROS_H
#define _CORE_NODE_V8_MACROS_H

#define NVM_TO_NUMBER_DOUBLE(value, isolate) ( \
	(value) \
	->ToNumber(isolate->GetCurrentContext()) \
	.FromMaybe(Local<Number>()) \
	->Value() \
)

#define NVM_NEW_INSTANCE(target, isolate, argc, argv) ( \
	(target) \
	->NewInstance(isolate->GetCurrentContext(), argc, argv) \
	.FromMaybe(Local<Object>()) \
)

#endif
