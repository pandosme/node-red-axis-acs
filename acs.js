const got = require("got");


module.exports = function(RED) {
    function ACS_Action(config) {
        RED.nodes.createNode(this,config);
		this.action = config.action;
		this.camera = config.camera;
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
			var camera = msg.camera || node.camera;
			var from = msg.from || node.from;
			var to = msg.to || node.to;
			var duration = msg.duration || node.duration;
			if( typeof duration === "string" ) {
				if( duration.length === 0 )
					duration = 0;
				duration = parseInt( duration );
			}
			if( duration < 0 )
				duration = 0;
			if( duration > 600 )
				duration = 600;
			switch( action ) {
				case "Info":
					var url = address + '/Acs/Api/SystemFacade/GetSystem';
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
							msg.error = error;
							msg.payload = null;
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

							list = [];
							response.body.CameraSettings.forEach(function(item){
								if( item.IsEnabled ) {
									var device = {
										id: item.CameraId.Id,
										name: item.CameraName,
										address: item.Address,
										port: item.HttpPort,
										model: item.Model,
										firmware: item.FirmwareVersion,
										serial: item.MacAddress
									};
									list.push(device);
								}
							});
							msg.payload = list;
							node.send(msg);
						} catch (error) {
							msg.error = error;
							msg.payload = null;
							node.send(msg);
						}
					})();
				break;
				case "List recordings":
					if( !camera || typeof camera !== "string" || camera.length < 15 ) {
						msg.error = "Invalid camera ID";
						msg.payload = "Camera id " + camera + " is not valid";
						node.send(msg);
						return;
					}
					var start = new Date();
					start.setHours(0);
					start.setMinutes(0);
					start.setSeconds(0);
					start.setMilliseconds(0);
					var end = new Date();
					if( typeof from === "number" && from > 1277924313000 )
						start = new Date(from);
					if( typeof from === "string" && from.length > 15 )
						start = new Date(from);
					if( typeof to === "number" && to > 1277924313000 )
						end = new Date(to);
					if( typeof to === "string" && to.length > 15 )
						end = new Date(to);
					
					var request  = {
						 "cameraIds": [{Id:camera}],
						"interval": {
							"StartTime": start.toISOString(),
							"StopTime": end.toISOString()
						},
						"range": {
							"StartIndex": 0,
							"NumberOfElements": 1000
						}
					}
					var url = address + '/Acs/Api/RecordingFacade/GetRecordedMedia?' + encodeURI(JSON.stringify(request));
					(async () => {
						try {
							const response = await got( url,{username: user,password:password,responseType: "json",https:{rejectUnauthorized: false}});
							msg.error = false;
							var list = [];
							response.body.RecordedMedia.forEach(function(item){
								var recording = {
							//            id: item.RecordingId,
									track: item.QualityLevel,
									start: start.getTime(),
									stop: end.getTime(),
									duration: 0  //parseInt( (to.getTime() - from.getTime()) / 1000 )
								}
								
								if( item.hasOwnProperty("StartTime") ) {
									item.StartTime[10] = 'T';
									item.StartTime += 'Z';
									recording.start = new Date(item.StartTime).getTime();
								}
									
								if( item.hasOwnProperty("EndTime") ) {
									item.EndTime[10] = 'T';
									item.EndTime += 'Z';
									recording.stop = new Date(item.EndTime).getTime();
								}
								recording.duration = parseInt( ( recording.stop - recording.start) / 1000 );
								list.push(recording);
							});
							msg.payload = list;
							node.send(msg);
						} catch (error) {
							msg.error = error;
							msg.payload = null;
							node.send(msg);
						}
					})();
				break;
				case "Get recording":
					if( !camera || typeof camera !== "string" || camera.length < 15 ) {
						msg.error = "Invalid camera ID";
						msg.payload = null;
						node.send(msg);
						return;
					}
					var start = null;
					var end = null;

					if( typeof from === "number" && from > 1277924313000 )
						start = new Date(from);
					if( typeof from === "string" && from.length > 15 )
						start = new Date(from);
					if( typeof to === "number" && to > 1277924313000 )
						end = new Date(to);
					if( typeof to === "string" && to.length > 15 )
						end = new Date(to);

					if( !start || !end ) {
						msg.error = "Invalid from or to time";
						msg.payload = null;
						node.send(msg);
					}

					//Adjust for triggered recordings
					start = new Date( start.getTime() + 1000);
					end = new Date( end.getTime() - 1000);
					
					if( start.getTime() >= end.getTime() ) {
						var t = start;
						end = start;
						start = t;
					}

					startTime = start.getUTCFullYear()+"-"+('0'+(start.getUTCMonth()+1)).substr(-2,2)+"-"+('0'+start.getUTCDate()).substr(-2,2) + "-";
					startTime += ('0'+start.getUTCHours()).substr(-2,2) + ('0'+start.getUTCMinutes()).substr(-2,2) + ('0'+start.getUTCSeconds()).substr(-2,2)+"-0000000Z";
					endTime = end.getUTCFullYear()+"-"+('0'+(end.getUTCMonth()+1)).substr(-2,2)+"-"+('0'+end.getUTCDate()).substr(-2,2) + "-";
					endTime += ('0'+end.getUTCHours()).substr(-2,2) + ('0'+end.getUTCMinutes()).substr(-2,2) + ('0'+end.getUTCSeconds()).substr(-2,2)+"-0000000Z";

					var request = "camera=" + camera;
					request += "&start=" + startTime;
					request += "&end=" + endTime;
					request += "&quality=highestavailable";
					request += "&audio=0";
					var url = address + '/Acs/Streaming/Video/Playback/MP4/?' + request;
					(async () => {
						try {
							const response = await got( url,{username: user,password:password,responseType: "buffer",https:{rejectUnauthorized: false}});
							msg.error = false;
							msg.payload = response.body;
							node.send(msg);
						} catch (error) {
							msg.error = error;
							msg.payload = null;
							node.send(msg);
						}
					})();
				break;

				case "Start recording":
					if( !camera || typeof camera !== "string" || camera.length < 3 ) {
						msg.error = "Invalid camera ID";
						msg.payload = null;
						node.send(msg);
						return;
					}
					var url = address + "/Acs/Api/TriggerFacade/ActivateTrigger?";
					var request = {
						triggerName: camera
					}
					if( duration > 0 ) {
						url = address + '/Acs/Api/TriggerFacade/ActivateDeactivateTrigger?';
						request.deactivateAfterSeconds = duration.toString();
					}
					url += encodeURI(JSON.stringify(request));
					console.log(url);
					(async () => {
						try {
							const response = await got( url,{username: user,password:password,responseType: "text",https:{rejectUnauthorized: false}});
							msg.error = false;
							msg.payload = "OK";
							node.send(msg);
						} catch (error) {
							msg.error = error;
							msg.payload = JSON.parse(error.response.body);
							node.send(msg);
						}
					})();
					
				break;
				
				case "Stop recording":
					if( !camera || typeof camera !== "string" || camera.length < 3 ) {
						msg.error = "Invalid camera ID";
						msg.payload = null;
						node.send(msg);
						return;
					}
					var url = address + "/Acs/Api/TriggerFacade/DeactivateTrigger?" + encodeURI(JSON.stringify({triggerName: camera}));
					console.log(url);
					(async () => {
						try {
							const response = await got( url,{username: user,password:password,responseType: "text",https:{rejectUnauthorized: false}});
							msg.error = false;
							msg.payload = "OK";
							node.send(msg);
						} catch (error) {
							msg.error = error;
							msg.payload = JSON.parse(error.response.body);
							node.send(msg);
						}
					})();
				break;
				
				default:
					msg.error = "Undefined Action";
					msg.payload = null;
					node.send( msg );
				break;
			}
        });
    }
	
    RED.nodes.registerType("ACS",ACS_Action,{
		defaults: {
            name: {type:"text"},
			server: {type:"ACS Server"},
			camera: { type:"text" },
			action: { type:"text" },
			from: {type:"text"},
			to: {type:"text"},
			duration: {type:"text"}
		}		
	});
}
