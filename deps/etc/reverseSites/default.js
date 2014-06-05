{
	interfaces:  [ 'reverseInterface'], 
	serverName: [ "_" ], // default site

	proxyStream: {
		nodeOne: {
			type: "rr",
			hybrid: true,
			primary: [
				{
					host: "94.23.253.174", 
				},
			],
			secondary: [
				{
					host: "94.23.253.174", 
				}
			]
		}
	},
	
	locations: [
		{ 
			name: 'root',
			regex: /.*/,
			pipeline: [
				['proxyPass', "nodeOne"],
			]
		}
	],
	

}
