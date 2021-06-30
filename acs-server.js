module.exports = function(RED) {
	function Axis_Server(config) {
		RED.nodes.createNode(this,config);
		this.name = config.name;
		this.address = config.address;
		this.port = config.port;
		this.user = config.user;
		this.password = config.password;
	}
	
	RED.nodes.registerType("ACS Server", Axis_Server,{
		defaults: {
			name: {type: "text"},
			address: {type: "text"},
			port: {type: "text"}
		},
		credentials: {
			user: {type: "text"},
			password: {type:"password"}
		}		
	});
}