const got = require("got");


module.exports = function(RED) {
    function ACS_Action(config) {
        RED.nodes.createNode(this,config);
		this.action = config.action;
		this.camera = config.camera;
		this.time = config.time;
		this.duration = config.duration;
		this.server = config.server;
        var node = this;
        node.on('input', function(msg) {
			var server = RED.nodes.getNode(node.server);
			var port = msg.port || server.port;
			var host = msg.address || server.address;
			var address = "https://" + host + ":" + port;
			var user = msg.user || server.credentials.user;
			var password = msg.password || server.credentials.password;
			var action = msg.action || node.action;
			var camera = msg.camera || node.camera;
			var time = msg.time || node.time;
			var duration = msg.duration || node.duration || 0;
			duration = parseInt( duration );
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
					if( typeof time === "string" ) {
						if( time.length === 10 )
							start = new Date(time + "T00:00:00");
						if( time.length > 13 )
							start = new Date(time);
					}

					if( typeof time === "number" && time > 1577836800000 )
						start = new Date(time);
					
					if( typeof time === "object" )
						start = new Date(time);
					
					start.setHours(0);
					start.setMinutes(0);
					start.setSeconds(0);
					start.setMilliseconds(0);
					if( duration < 1 )
						duration = 1;
					if( duration > 31 )
						duration = 31;
					
					var end = new Date( start.getTime() + (duration*24*3600*1000));
					
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
									timestamp: 0,
									date: "",
									time: "",
									duration: 0  //parseInt( (to.getTime() - time.getTime()) / 1000 )
								}
								t1 = start;
								if( item.hasOwnProperty("StartTime") ) {
									item.StartTime[10] = 'T';
									item.StartTime += 'Z';
									t1 = new Date(item.StartTime);
								}
								var t2 = new Date();	
								if( item.hasOwnProperty("EndTime") ) {
									item.EndTime[10] = 'T';
									item.EndTime += 'Z';
									t2 = new Date(item.EndTime);
								}
								recording.timestamp = t1.getTime();
								recording.duration = parseInt( ( t2.getTime() - t1.getTime() ) / 1000 );
								recording.date = t1.getFullYear()+"-"+('0'+(t1.getMonth()+1)).substr(-2,2)+"-"+('0'+t1.getDate()).substr(-2,2);
								recording.time = ('0'+t1.getHours()).substr(-2,2) + ":" + ('0'+t1.getMinutes()).substr(-2,2) +":"+ ('0'+t1.getSeconds()).substr(-2,2);
								list.push(recording);
							});
							msg.payload = {
								from: start.getTime(),
								to: end.getTime(),
								recordings: list
							}
							node.send(msg);
							return;
						} catch (error) {
							msg.error = error;
							msg.payload = null;
							node.send(msg);
							return;							
						}
					})();
				break;
				case "Get recording":
					if( !camera || typeof camera !== "string" || camera.length < 15 ) {
						msg.error = "Invalid ACS camera ID";
						msg.payload = null;
						node.send(msg);
						return;
					}
					
					var start = new Date( new Date().getTime() - (60*1000) ); //Default to now - 1 minut if time is not set
					if( typeof time === "string" ) {
						if( time.length === 10 )
							start = new Date(time + "T00:00:00");
						if( time.length > 13 )
							start = new Date(time);
					}

					if( typeof time === "number" && time > 1577836800000 )
						start = new Date(time);
					
					if( typeof time === "object" )
						start = new Date(time);

					start = new Date( new Date(start) + 1000);
					
					if( duration < 10 )
						duration = 60;

					end = new Date( start.getTime() + (duration * 1000) - 2000);
					
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
							msg.date = start.getFullYear()+"-"+('0'+(start.getMonth()+1)).substr(-2,2)+"-"+('0'+start.getDate()).substr(-2,2);
							msg.time = ('0'+start.getHours()).substr(-2,2) + ":" +  ('0'+start.getMinutes()).substr(-2,2) + ":" +  ('0'+start.getSeconds()).substr(-2,2);
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
			time: {type:"text"},
			duration: {type:"text"}
		}		
	});
}
