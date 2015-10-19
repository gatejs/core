

var postMgr = function() { /* loader below */ };

postMgr.init = function(pipe) {
	pipe.postMgrs = {
		list: [],
	};
};

postMgr.register = function(pipe, mgr) {
	if(pipe.postMgrs.list.length == 0) {
		pipe.request.pipe(mgr);
		pipe.postMgrs.list.push(mgr);
	}
	else {
		pipe.postMgrs.list[pipe.postMgrs.list.length - 1].pipe(mgr);
		pipe.postMgrs.list.push(mgr);
	}
};

postMgr.loader = function(gjs) {
	
};

module.exports = postMgr;

