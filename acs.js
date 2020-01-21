module.exports = function(RED) {
    function Axis_ACS(config) {
        RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.protocol = config.protocol;
		this.data = config.data;
		this.output = config.output;
        var node = this;
        node.on('input', function(msg) {
			var address = msg.address || node.address;
			var action = msg.action || node.action;
			var account = RED.nodes.getNode(this.account);
			var user = msg.user || account.credentials.username;
			var password = msg.password || account.credentials.password;
			var data = msg.data || node.data;
			var protocol = account.protocol;
			if( address.length < 6 ) {
				msg.error = "Invalid address";
				msg.payload = {};
				node.send(msg);
				return;
			}
			//console.log(action + ":" + address + "/" + data);
			switch( action ) {
				case "TBD":
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
	
    RED.nodes.registerType("device",Axis_ACS,{
		defaults: {
            name: {type:"text"},
			account: {type:"device-credentials"},
			address: {type:"text"},
			action: { type:"text" },
			data: {type:"text"},
			output: { type: "default"}
		}		
	});
	
	function Axis_ACS_Credentials(config) {
			RED.nodes.createNode(this,config);
			this.name = config.name;
			this.protocol = config.protocol;
	}
	
	RED.nodes.registerType("device-credentials",Axis_ACS_Credentials,{
		defaults: {
            name: {type:""},
			protocol: {type:"text"}
		},
		credentials: {
			username: {type:"text"},
			password: {type:"password"}
		}		
	});
}
