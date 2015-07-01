var ccode = require(__dirname+'/build/Release/core.node');

console.log("dateToStr", ccode.dateToStr());
console.log("dateToStr", ccode.dateToStr("%Y"));
console.log("dateToStr", ccode.dateToStr(424242424242));
console.log("dateToStr", ccode.dateToStr(424242424242, "%Y"));

console.log("");
console.log("cstrrev", "abcdef", ccode.cstrrev("abcdef"));

console.log("");
var nreg = ccode.nreg({
	is_insensitive: false,
	expressions: [
		'*/*',
		'*test*',
		'42*',
		'*24',
	],
});
console.log("nreg", true  == !!nreg.match('ab/cd'));
console.log("nreg", true  == !!nreg.match('/cd'));
console.log("nreg", true  == !!nreg.match('ab/'));
console.log("nreg", true  == !!nreg.match('/'));
console.log("nreg", false == !!nreg.match('tes'));
console.log("nreg", false == !!nreg.match('est'));
console.log("nreg", true  == !!nreg.match('test'));
console.log("nreg", true  == !!nreg.match('424'));
console.log("nreg", false == !!nreg.match('242'));
