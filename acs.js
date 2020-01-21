var request = require('request');

module.exports = function(RED) {
    function Axis_ACS(config) {
        RED.nodes.createNode(this,config);
		this.server = config.server;
		this.action = config.action;
		this.data = config.data;
		this.output = config.output;
        var node = this;
        node.on('input', function(msg) {
			var action = msg.action || node.action;
			//console.log("Action: " + action );
			var server = RED.nodes.getNode(this.server);
			var address = server.address;
			//console.log("Address: " + address );
			var port = server.port;
			//console.log("Port: " + port );
			var user = server.credentials.username;
			//console.log("User: " + user );
			var password = server.credentials.password;
			//console.log("Password: " + password );
			var data = msg.data || node.data;
			//console.log("Data: " + data );
			if( address.length < 6 ) {
				msg.error = "Invalid address";
				msg.payload = {};
				node.send(msg);
				return;
			}
			//console.log(action + ":" + address + "/" + data);
			switch( action ) {
				case "Inventory":
					var options = {
						url: 'https://' + address + ':' + port + '/Acs/Api/ServerConfigurationFacade/GetServerConfiguration',
						strictSSL: false
					}
					//console.log("URL: " + options.url );
					request.get(options, function (error, response, body) {
						if( error ) {
							//console.log("Error response");
							msg.error = true;
							msg.payload = body.toString();
							node.send(msg);
							return;
						}
						if( response.statusCode !== 200 ) {
							//console.log("Error: " + response.statusCode );
							//console.log(body);
							msg.error = true;
							msg.payload = body;
							node.send(msg);
							return;
						}
						var data = JSON.parse(body);
						if( !data ) {
							msg.error = true;
							msg.payload = "JSON parse error";
						}
						//console.log(data);
						var list = [];
						for( var i = 0; i < data.CameraSettings.length; i++) {
							//console.log(data.CameraSettings[i].CameraName);
							list.push({
								id: data.CameraSettings[i].CameraId.Id,
								name: data.CameraSettings[i].CameraName,
								vendor: data.CameraSettings[i].Manufacturer,
								model: data.CameraSettings[i].Model,
								firmware: data.CameraSettings[i].FirmwareVersion,
								address: data.CameraSettings[i].Address,
								serial: data.CameraSettings[i].MacAddress,
								disconnects: data.CameraSettings[i].DisconnectSinceServerStart
							});
						};
						msg.error = false;
						msg.payload = list;
						node.send(msg);
					}).auth( user, password, true);
				break;
				
				default:
					msg.error = true;
					msg.statusCode = 0;
					msg.payload = action + " is not a valid action";
					node.send(msg);
				break;
			}
        });
    }
	
    RED.nodes.registerType("Axis ACS",Axis_ACS,{
		defaults: {
            name: {type:"text"},
			server: {type:"ACS Server"},
			action: { type:"text" },
			data: {type:"text"},
			output: { type: "default"}
		}		
	});
	
	function Axis_ACS_Credentials(config) {
			RED.nodes.createNode(this,config);
			this.name = config.name;
			this.address = config.address;
			this.port = config.port;
	}
	
	RED.nodes.registerType("ACS Server",Axis_ACS_Credentials,{
		defaults: {
            name: {type:""},
			address: {type: ""},
			port: {type: ""}
		},
		credentials: {
			username: {type:"text"},
			password: {type:"password"}
		}		
	});
}
