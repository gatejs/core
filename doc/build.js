var fs = require('fs');
var mu = require('../src/lib/mu2/index.js');

var build  = function() {
	var version = "1.6";
	var vdf = "/index.php";
	var vd = '/documentation/1-6/';
	
	console.log('gatejs documentation builder');
	
	var pass1Elements = [];
	
	var lineCallback;
	var currentState2;
	var current;
	var lineNo;
	
	/* check argv */
	var destination = process.argv[2];
	var destinationStat = fs.statSync(destination);
	if(!destinationStat || !destinationStat.isDirectory()) {
		console.log(destination+' is not a valid destination dir');
		process.exit(0);
	}
	
	function state2Mark(line) {
		if((m = line.match(/}}/))) {
			lineCallback = state1;
			current.content.push(currentState2);
		}
		else
			currentState2.content += line+"\n";
		
	}
	
	function state2Example(line) {
		if((m = line.match(/}}/))) {
			lineCallback = state1;
			current.content.push(currentState2);
		}
		else
			currentState2.content += line+"\n";
	}
	
	function state1(line) {
		var m;
		
		if((m = line.match(/mark(.*){{/))) {
			currentState2 = {
				type: 'mark',
				content: ''
			};
			lineCallback = state2Mark;
		}
		else if((m = line.match(/example(.*){{/))) {
			currentState2 = {
				type: 'example',
				content: ''
			};
			lineCallback = state2Example;
		}
		else if((m = line.match(/param-([a-zA-Z0-9-]+): (.*)/)))
			current.params[m[1]] = m[2];
		else if((m = line.match(/([a-zA-Z0-9-]+): (.*)/)))
			current.vars[m[1]] = m[2];
		else if((m = line.match(/}}/))) {
			pass1Elements.push(current);
			lineCallback = state0;
		}
	}

	function state0(line) {
		var m;
		
		if((m = line.match(/(.*) {{/))) {
			current =  {
				line: lineNo,
				name: m[1],
				vars: {},
				params: {},
				content: []
			}

			lineCallback = state1;
		}
	}
	
	
	function loadFile(filename) {
		var data = fs.readFileSync(filename).toString();
		var lines = data.split('\n');
		lineNo = 1;
		for(var a in lines) {
			lineCallback(lines[a]);
			lineNo++;
		}
	}
	
	function processFile(filename) {
		lineCallback = state0;
		loadFile(filename);
	}
	
	/* run scan file */
	var dirs = fs.readdirSync(__dirname+'/references/');
	for(var a in dirs) {
		var dir = dirs[a];
		if(dir.match(/(.*)\.ref/))
			processFile(__dirname+'/references/'+dir);
	}
	
	/* generate md files */
	var indexes = [];
	
	/* create indexes */
	for(var k in pass1Elements) {
		var el = pass1Elements[k];
		indexes[el.name] = el;
	}
	
	/* render pages */
	for(var k in pass1Elements) {
		var el = pass1Elements[k];
		indexes[el.name] = el;

		el.vd = vd;
		el.vdf = vdf;
		el.filename = el.name.split(':').join('-');
		el.render = {};
		
		el.render.header = "{{title gatejs docs: "+el.name+" - "+el.vars.description+"}}\n"+
			"{{template gatePage}}\n"
		
		/* render text & example */
		if(el.content.length > 0) {
			el.render.content = '';
			for(var a in el.content) {
				var p = el.content[a];
				if(p.type == "mark") {
					el.render.content += p.content+"\n";
				}
				else if(p.type == "example") {
					el.render.content += "```\n"+p.content+"```\n";
				}
			}
		}
		

		
		if(el.vars.type == "object-kv") {
			
			/* value */
			if(el.vars.value) {
				var t = el.vars.value.split(' ');
				el.render.value = '';
				for(var a in t) {
					var p = indexes[t[a]];
				console.log(t[a], t[a].split(':').join('-'));
				
					t[a].split(':').join('-');
					
					if(p)
						el.render.value += '* ['+p.vars.description+']('+vd+t[a].split(':').join('-')+")\n";
				}
			}
		}
		
		function buildJoin(param) {
			var res = '';
			var ss = param.split(' ');
			for(var b in ss) {
				var r = ss[b].match(/::(.*)/);
				if(r) {
					var p = indexes[r[1]];
					if(p) 
						res += '['+p.vars.description+']('+vd+p.name.split(':').join('-')+')';
					else
						res += ss[b]+' ';
				}
				else
					res += ss[b]+' ';
			}
			return(res);
		}
		
		function link(param) {
			var res = '';
			var ss = param.split(' ');
			for(var b in ss) {
				var p = indexes[ss[b]];
				if(b > 0)
					res += ', '
				if(p) 
					res += '['+p.vars.description+']('+vd+p.name.split(':').join('-')+')';
				else
					res += ss[b];
			}
			return(res);
		}
		
		
		if(el.vars.type == "object-opt") {
			el.render.params = '';
			if(el.params) {
				for(var a in el.params) {
					var res = buildJoin(el.params[a]);
					
					el.render.params += "* **"+a+"**: "+res+"\n";
				}
			}
		}
		
		if(el.vars.type == "array-opt") {
			el.render.params = '';
			if(el.params) {
				for(var a in el.params) {
					var res = buildJoin(el.params[a]);
					
					el.render.params += ""+a+". "+res+"\n";
				}
			}
		}
		
		
		if(el.vars.scope) {
			var res = link(el.vars.scope);
			if(!res)
				el.render.scope = el.vars.scope;
			else {
				el.render.scope = res;
			}
		}
		
		if(el.vars.extends) {
			var res = link(el.vars.extends);
			if(!res)
				el.render.extends = el.vars.extends;
			else {
				el.render.extends = res;
			}
		}
		
		
		/* see also */
		if(el.vars.see) {
			
			var res = link(el.vars.see);
			if(!res)
				el.render.see = el.vars.see;
			else {
				el.render.see = res;
			}
		}
		
		
		var fd = fs.createWriteStream(destination+'/'+el.filename+'.md', {
			flags: 'w+',
			mode: 0666,
			autoClose: true
		});
		var content = mu.compileAndRender(__dirname+"/tpl/"+el.vars.type+".tpl", el);
		content.pipe(fd);
		
	}
	
	
	/* render manuel index */
	var inside = {
		vd: vd,
		header: "{{title gatejs docs: index}}\n"+
			"{{template gatePage}}\n",
		summary: '',
		version: version
	};
	
	function concatIndex(start, key, level) {
		if(!level)
			level = 1;
		var p = indexes[start];
		if(!p)
			return;
		
		for(var a=0; a<level; a++)
			inside.summary += '* ';
		
		inside.summary += '['+p.vars.description+']('+vd+p.name.split(':').join('-')+")\n";
		
		/* search for depends */
		for(var a in indexes) {
			var n = indexes[a];
			if(n.vars[key]) {
				var s = n.vars[key].split(' ');
				for(var b in s) {
					if(s[b] == p.name) {
						concatIndex(n.name, key, level+1);
						console.log(n.name);
					}
				}
			}
		}
	}
	
	concatIndex('root', 'extends');
	var fd = fs.createWriteStream(destination+'/index.md', {
		flags: 'w+',
		mode: 0666,
		autoClose: true
	});
	var content = mu.compileAndRender(__dirname+"/tpl/index.tpl", inside);
	content.pipe(fd);
	
	var inside = {
		vd: vd,
		header: "{{title gatejs docs: scope view}}\n"+
			"{{template gatePage}}\n",
		summary: '',
		version: version
	};
	concatIndex('root', 'scope');
	var fd = fs.createWriteStream(destination+'/scope.md', {
		flags: 'w+',
		mode: 0666,
		autoClose: true
	});
	var content = mu.compileAndRender(__dirname+"/tpl/scope.tpl", inside);
	content.pipe(fd);
	
	
// 	concatIndex('reverseSite');
	for(var k in pass1Elements) {
		var el = pass1Elements[k];
		
		
		
	}

	

	
// 	console.log(indexes);
	
	
}


build();

