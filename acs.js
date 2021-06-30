const got = require("got");

module.exports = function(RED) {
	function Axis_Server(config) {
		RED.nodes.createNode(this,config);
		this.name = config.name;
		this.address = config.address;
		this.port = config.port;
		this.user = config.user;
		this.password = config.password;
	}
	
	RED.nodes.registerType("acs-server", Axis_Server,{
		defaults: {
			name: {type: "text"},
			address: {type: "text"},
			port: {type: "text"},
		},
		credentials: {
			user: {type: "text"},
			password: {type:"password"}
		}		
	});
}


module.exports = function(RED) {
    function ACS_Action(config) {
        RED.nodes.createNode(this,config);
		this.server = config.server,
		this.name = config.name;
		this.address = config.address;
		this.user = config.user;
		this.password = config.password;
        var node = this;
        node.on('input', function(msg) {
			var server = RED.nodes.getNode(this.server);
			var address = "https://"+server.address+":"+server.port;
			var action = msg.action || node.action;
			var camera = msg.payload.camera || node.camera;
			var from = msg.payload.from || node.from;
			var to = msg.payload.to || node.to;
			var duration = msg.payload.duration || node.duration;
			switch( action ) {
				case "Info":
					var url = address + '/Acs/Api/SystemFacade/GetSystem',
					(async () => {
						try {
							const response = await got( url,{
								responseType: "json",
								https:{rejectUnauthorized: false}
							});
							msg.error = false;
							msg.payload = {
								name: response.body.Name || "Undefined",
								version: response.body.ServerDisplayVersion || "Undefined",
								timezone: response.body.ServerDisplayVersion|| "Undefined",
								hardware: response.body.ModelName|| "Undefined",
								vendor: response.bodyVendor || "Undefined"
							}
							node.send(msg);
							callback(false, response.body );
						} catch (error) {
							msg.error = error;
							msg.payload = error;
							node.send(msg);
						}
					})();
				break;
				
				case "Inventory":
					var url = address + '/Acs/Api/ServerConfigurationFacade/GetServerConfiguration',
					(async () => {
						try {
							const response = await got( url,{
								responseType: "json",
								https:{rejectUnauthorized: false}
							});
							msg.error = false;
							msg.payload = response.body;
							node.send(msg);
							callback(false, response.body );
						} catch (error) {
							msg.error = error;
							msg.payload = error;
							node.send(msg);
						}
					})();
				break;
			}
        });
    }
	
    RED.nodes.registerType("acs-actions",ACS_Action,{
		defaults: {
            name: {type:"text"},
			server: {type:"acs-server"},
			action: { type:"text" },
			data: {type:"text"},
			from: {type:"text"},
			to: {type:"text"},
			duration: {type:"text"}
		}		
	});
}
