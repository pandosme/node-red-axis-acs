const got = require("got");


function HTTP_Get( url, resonseType, callback ) {
	var client = got.extend({
		hooks:{
			afterResponse: [
				(res, retry) => {
					const options = res.request.options;
					const digestHeader = res.headers["www-authenticate"];
					if (!digestHeader){
//						console.error("Response contains no digest header");
						return res;
					}
					const incomingDigest = digestAuth.ClientDigestAuth.analyze(	digestHeader );
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, device.user, device.password,{
						method: options.method,
						uri: options.url.pathname,
						counter: 1
					});
					options.headers.authorization = digest.raw;
					return retry(options);
				}
			]
		}
	});

	(async () => {
		try {
			const response = await client.get( url,{
				responseType: resonseType,
				https:{rejectUnauthorized: false}
			});
			callback(false, response.body );
		} catch (error) {
			callback(error, error );
		}
	})();
}


module.exports = function(RED) {
    function ACS_Action(config) {
        RED.nodes.createNode(this,config);
		this.action = config.action;
		this.from = config.from;
		this.to = config.to;
		this.duration = config.duration;
		this.server = config.server;
        var node = this;
        node.on('input', function(msg) {
			var server = RED.nodes.getNode(node.server);
			var address = "https://" + server.address + ":" + server.port;
			var user = server.credentials.user;
			var password = server.credentials.password;
			var action = msg.action || node.action;
			var camera = msg.payload.camera || node.camera;
			var from = msg.payload.from || node.from;
			var to = msg.payload.to || node.to;
			var duration = msg.payload.duration || node.duration;
			switch( action ) {
				case "Info":
					console.log("Info");
					var url = address + '/Acs/Api/SystemFacade/GetSystem';
					console.log(url);
					(async () => {
						try {
							const response = await got( url,{
								username: user,
								password: password,
								responseType: "json",
								https:{rejectUnauthorized: false}
							});
							
							msg.error = false;
							msg.payload = {
								name: response.body.Name || "Undefined",
								version: response.body.ServerDisplayVersion || "Undefined",
								timezone: response.body.ServerDisplayVersion|| "Undefined",
								hardware: response.body.Hardware.ModelName|| "Undefined",
								vendor: response.body.Hardware.Vendor || "Undefined"
							}

							node.send(msg);
						} catch (error) {
							console.log(error);
							msg.error = error;
							msg.payload = error;
							node.send(msg);
						}
					})();
				break;
				
				case "Inventory":
					var url = address + '/Acs/Api/ServerConfigurationFacade/GetServerConfiguration';
					(async () => {
						try {
							const response = await got( url,{username: user,password:password,responseType: "json",https:{rejectUnauthorized: false}});
							msg.error = false;
							msg.payload = response.body.CameraSettings;
							node.send(msg);
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
	
    RED.nodes.registerType("ACS",ACS_Action,{
		defaults: {
            name: {type:"text"},
			server: {type:"ACS Server"},
			action: { type:"text" },
			data: {type:"text"},
			from: {type:"text"},
			to: {type:"text"},
			duration: {type:"text"}
		}		
	});
}
