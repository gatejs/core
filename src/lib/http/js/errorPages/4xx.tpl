<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en" dir="ltr">

<head>
<title>{{code}} - {{title}}</title>

<link rel="stylesheet" type="text/css" href="http://fonts.googleapis.com/css?family=Playball">
<link rel="stylesheet" type="text/css" href="http://fonts.googleapis.com/css?family=Droid Sans">

<style>

html {
	-webkit-font-smoothing: antialiased;
}

body {
	font-family: 'Droid Sans', "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Verdana, Tahoma, sans-serif;
	font-size: 14px;
	color: black;

/*	background-image: url('{{vd}}/bg.jpg');
	background-repeat:no-repeat;
	background-attachment:fixed;
	background-position:center; */
	
	margin: 0; padding: 0px;
	border-top: 10px #7f7f7f solid;
}

a {
	color: black;
	text-decoration: underline;
}

a:visited {
	color: black;
	text-decoration: underline;
}

a:hover,
a:focus {
	color: #d42618;
	text-decoration: none;
}


#frame {
	text-align: center;
}

.bgDiv {
	width: 400px; 
}

.bottomName {
	font-size: 8pt;
	line-height: 16px;
}
 
.logo {
	font-family: 'Playball', serif;
	font-size: 60pt;
	font-weight: bold;
}

</style>


<script language="javascript">
function window_size_check() {
	function checker() {
		el = document.getElementById("frame");
		var t = r = b = l = '0px';
		t = Math.round((window.innerHeight/6)) + "px";
		l = Math.round(((window.innerWidth-400)/2)) + "px";
		el.style.padding = t+' '+r+' '+b+' '+l;
	}
	checker();
	var id = setInterval(checker, 500);
}

// check windows resize
if(window.addEventListener)
	window.addEventListener('load', window_size_check, false)
else if (window.attachEvent)
	window.attachEvent('onload', window_size_check)
	
</script>



</head>

<body>

<div id="frame">
	<div class="bgDiv">
		<div class="logo"><span style='color: #3399cc;'>gate</span><span style='color: #7f7f7f;'>.</span><span style='color: #66cc33;'>js</span></div>
		<p>Problem occurs when loading the page</p>
		<h2>{{code}} - {{title}}</h2>
		<p>{{explain}}<p>
		<hr size="1"/>

		<p class="bottomName">&copy; <span class="logo"  style="font-size: 14pt;"><span style='color: #3399cc;'>gate</span><span style='color: #7f7f7f;'>.</span><span style='color: #66cc33;'>js</span></span><br/>
		<strong>Copyright 2007-2014</strong><br/>
		<a href="http://www.gatejs.org/">www.gatejs.org</a> | <a href="http://www.binarysec.com/">www.binarysec.com</a></p>
	</div>
</div>
</body>

</html>