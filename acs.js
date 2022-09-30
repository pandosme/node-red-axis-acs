const got = require("got");

function ACS_GET( url, user, password, success, failure ) {
console.log( url );	
	(async () => {
		try {
			const response = await got( url,{
				username: user,
				password: password,
				responseType: "json",
				https:{rejectUnauthorized: false}
			});
			success( response.body );
		} catch (error) {
			if( error.code === 'ECONNREFUSED' ) {
				failure({
					statusCode: error.code,
					statusMessage: "Connection refused",
					body: "Port is not active or blocked by firewall"
				});
				return;
			}
			if( error.code === 'EHOSTUNREACH' ) {
				failure({
					statusCode: error.code,
					statusMessage: "Unreachable",
					body: "Host does not respond"
				});
				return;
			}
			if( error.code === 'ETIMEDOUT' ) {
				failure({
					statusCode: error.code,
					statusMessage: "Timeout",
					body: "Host does not respond"
				});
				return;
			}
console.log( "Request error:" + url + " " + error.code );
			failure({
				statusCode: error && error.response ? error.response.statusCode:error.code,
				statusMessage: error && error.response ? error.response.statusMessage:"Unkown error",
				body: error && error.response ? error.response.body.Message:"No additional information"
			});
		}
	})();
}	

function ACS_POST( url, user, password, json, success, failure ) {
	(async () => {
		try {
			const response = await got.post( url,{
				json: json,
				username: user,
				password: password,
				responseType: "json",
				https:{rejectUnauthorized: false}
			});
			success( response.body );
		} catch (error) {
			if( error.code === 'ECONNREFUSED' ) {
				failure({
					statusCode: error.code,
					statusMessage: "Connection refused",
					body: "Port is not active or blocked by firewall"
				});
				return;
			}
			if( error.code === 'EHOSTUNREACH' ) {
				failure({
					statusCode: error.code,
					statusMessage: "Unreachable",
					body: "Host does not respond"
				});
				return;
			}
			if( error.code === 'ETIMEDOUT' ) {
				failure({
					statusCode: error.code,
					statusMessage: "Timeout",
					body: "Host does not respond"
				});
				return;
			}
console.log( "Request error:" + url + " " + error.code );
			failure({
				statusCode: error && error.response ? error.response.statusCode:0,
				statusMessage: error && error.response ? error.response.statusMessage:"Unkown error",
				body: error && error.response ? error.response.body.Message:"No additional information"
			});
		}
	})();
}	


module.exports = function(RED) {
    function ACS_Action(config) {
        RED.nodes.createNode(this,config);
		this.action = config.action;
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
			switch( action ) {
				case "Info": {
					ACS_GET( address + '/Acs/Api/SystemFacade/GetSystem', user, password,
						function(response){
							msg.payload = {
								name: response.Name || "Undefined",
								version: response.ServerDisplayVersion || "Undefined",
								timezone: response.TimeZone|| "Undefined",
								hardware: response.Hardware.ModelName|| "Undefined",
								vendor: response.Hardware.Vendor || "Undefined"
							}
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg);
						}
					);
				}
				break;
				
				case "Inventory": {
					ACS_GET( address + '/Acs/Api/ServerConfigurationFacade/GetServerConfiguration', user, password,
						function(response){
							list = [];
							response.CameraSettings.forEach(function(item){
								if( item.IsEnabled ) {
									var device = {
										id: item.CameraId.Id,
										name: item.CameraName,
										address: item.Address,
										port: item.HttpPort,
										model: item.Model,
										firmware: item.FirmwareVersion,
										serial: item.MacAddress,
										disconnects: item.DisconnectSinceServerStart
									};
									list.push(device);
								}
							});
							msg.payload = list;
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				}
				break;

			
				case "List recordings": {
					if( !msg.payload.hasOwnProperty("camera") || typeof msg.payload.camera !== "string" || msg.payload.camera.length < 15 ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property camera"
						}
						node.error( "Invalid input", msg);
						return;
					}
					if( !msg.payload.hasOwnProperty("from") ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing property from"
						};							
						node.error( "Missing property from", msg);
						return;
					}
					var from = new Date(msg.payload.from);
					var to = new Date();
					if( msg.payload.hasOwnProperty("to") )
						to = new Date(msg.payload.to);
					
					var request  = {
						 "cameraIds": [{Id:msg.payload.camera}],
						"interval": {
							"StartTime": from.toISOString(),
							"StopTime": to.toISOString()
						},
						"range": {
							"StartIndex": 0,
							"NumberOfElements": 1000
						}
					}

					ACS_GET( address + '/Acs/Api/RecordingFacade/GetRecordedMedia?' + encodeURI(JSON.stringify(request)), user, password,
						function(response){
							var list = [];
							response.RecordedMedia.forEach(function(item){
								var recording = {
									id: item.RecordingId,
									track: item.QualityLevel,
									time: 0,
									duration: 0,
								}
								var t1 = from;
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
								recording.time = t1;
								recording.duration = parseInt( ( t2.getTime() - t1.getTime() ) / 1000 );
								list.push(recording);
							});
							msg.payload = list;
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				}
				break;

				case "Start recording": {
					if( typeof msg.payload !== "string" || msg.payload.length < 15 ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "msg.payload must be a camera ID string"
						}
						node.error( "Invalid input", msg);
						return;
					}
					var url = address + '/Acs/Api/RecordingControlFacade/StartRecording';
					ACS_POST( url, user, password,
						{cameraID:{Id:msg.payload}},
						function(response){
							msg.payload = "Recording started";
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				}
				break;

				case "Stop recording": {
					if( typeof msg.payload !== "string" || msg.payload.length < 15 ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "msg.payload must be a camera ID string"
						}
						node.error( "Invalid input", msg);
						return;
					}
					var url = address + '/Acs/Api/RecordingControlFacade/StopRecording';
					ACS_POST( url, user, password,
						{cameraID:{Id:msg.payload}},
						function(response){
							msg.payload = "Recording stopped";
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				}
				break;

				case "Bookmark": {
					if( !msg.payload.hasOwnProperty("camera") || typeof msg.payload.camera !== "string" || msg.payload.camera.length < 15 ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property camera"
						}
						node.error( "Invalid input", msg);
						return;
					}
					if( !msg.payload.hasOwnProperty("type") || typeof msg.payload.camera !== "string" ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property type"
						}
						node.error( "Invalid input", msg);
						return;
					}

					var url = address + '/Acs/ApiBookmarkFacade/AddBookmark';
					var request = {
						CameraId: {
							Id: msg.payload.camera
						},
						Name: msg.payload.type
					}

					if( msg.payload.hasOwnProperty("time") ) {
						var time = new Date(time);
						request.time = time.getUTCFullYear()+"-"+('0'+(time.getUTCMonth()+1)).substr(-2,2)+"-"+('0'+time.getUTCDate()).substr(-2,2) + " ";
						request.time += ('0'+from.getUTCHours()).substr(-2,2) + ":" + ('0'+from.getUTCMinutes()).substr(-2,2) + ":" + ('0'+from.getUTCSeconds()).substr(-2,2);
					}
					if( msg.payload.hasOwnProperty("text") )
						request.Desription = msg.payload.text;
					ACS_POST( url, user, password,
						request,
						function(response){
							msg.payload = "Bookmark added";
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				}
				break;
				
				case "Export MP4": {
					if( !msg.payload.hasOwnProperty("camera") || typeof msg.payload.camera !== "string" || msg.payload.camera.length < 15 ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property camera"
						}
						node.error( "Invalid input", msg);
						return;
					}
					if( !msg.payload.hasOwnProperty("from") ) {
						msg.error = "Invalid from";
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing proprty from"
						}						
						node.error( "Invalid input", msg );
						return;
					}
					
					var from = new Date( new Date(msg.payload.from).getTime() + 1000 );  //Make sure the timestamp is withing recording period
					var to = new Date( from.getTime() + 15000 );
					if( msg.payload.hasOwnProperty("to") )
						to = new Date(msg.payload.to);
					var startTime = from.getUTCFullYear()+"-"+('0'+(from.getUTCMonth()+1)).substr(-2,2)+"-"+('0'+from.getUTCDate()).substr(-2,2) + "-";
					startTime += ('0'+from.getUTCHours()).substr(-2,2) + ('0'+from.getUTCMinutes()).substr(-2,2) + ('0'+from.getUTCSeconds()).substr(-2,2)+"-0000000Z";
					endTime = to.getUTCFullYear()+"-"+('0'+(to.getUTCMonth()+1)).substr(-2,2)+"-"+('0'+to.getUTCDate()).substr(-2,2) + "-";
					endTime += ('0'+to.getUTCHours()).substr(-2,2) + ('0'+to.getUTCMinutes()).substr(-2,2) + ('0'+to.getUTCSeconds()).substr(-2,2)+"-0000000Z";

					var request = "camera=" + msg.payload.camera;
					request += "&start=" + startTime;
					request += "&end=" + endTime;
					request += "&quality=highestavailable";
					request += "&audio=0";
					var url = address + '/Acs/Streaming/Video/Playback/MP4/?' + request;
					(async () => {
						try {
							const response = await got( url,{username: user,password:password,responseType: "buffer",https:{rejectUnauthorized: false}});
							msg.payload = response.body;
							node.send(msg);
						} catch (error) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					})();
				}
				break;

				case "Trigger": {
					if( msg.payload !== "string" ) {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "payload must be a string (Trigger ID)"
						};
						node.error( "Invalid input", msg);
						return;
					}
					var duration = msg.payload.duration || 0;
					var state = msg.payload.state || true;
					
					var url = address + "/Acs/Api/TriggerFacade/ActivateTrigger?";
					var request = {
						triggerName: msg.payload.id
					}
					if( duration > 0 ) {
						url = address + '/Acs/Api/TriggerFacade/ActivateDeactivateTrigger?';
						request.deactivateAfterSeconds = duration.toString();
					}
					if( !state )
						url = address + "/Acs/Api/TriggerFacade/DeactivateTrigger?" + encodeURI(JSON.stringify({triggerName: msg.payload.camera}));
					
					url += encodeURI(JSON.stringify(request));

					ACS_GET( url, user, password,
						function(response){
							msg.payload = "Trigger state: " + state;
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				}	
				break;
				
				case "Add camera":
					if( !msg.payload.hasOwnProperty("address") || typeof msg.payload.address !== "string") {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property address"
						}
						node.error( "Invalid input", msg);
						return;
					}
					if( !msg.payload.hasOwnProperty("user") || typeof msg.payload.user !== "string") {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property address"
						}
						node.error( "Invalid input", msg);
						return;
					}
					if( !msg.payload.hasOwnProperty("password") || typeof msg.payload.user !== "string") {
						msg.payload = {
							statusCode: 400,
							statusMessage: "Invalid input",
							body: "Missing or invalid property password"
						}
						node.error( "Invalid input", msg);
						return;
					}
					
					var postBody = {
						"ConnectionInfo": {
							"Address": msg.payload.address,
							"Port": msg.payload.port || "443"
						},
						"AuthenticationInfo": {
							"Username": msg.payload.user,
							"Password": msg.payload.password,
							"SecurityMode": "HttpsDigest"
						},
						"Options": {
							"Name": msg.payload.name || msg.payload.address,
							"Description": msg.payload.description || "",
							"RetentionTime": msg.payload.retention || 0,
							"ViewToken": "0"
						}
					};
		
					ACS_POST( address + '/Acs/Api/CameraFacade/AddCamera', user, password,
						postBody,
						function(response){
							msg.payload = response.body;
							node.send(msg);
						},
						function( error ) {
							msg.payload = error;
							node.error( error.statusMessage,msg );
						}
					);
				
					break;
				
				default:
					node.error("Invalid action: " + action,msg);
				break;
			}
        });
    }
	
    RED.nodes.registerType("Camera Station",ACS_Action,{
		defaults: {
            name: {type:"text"},
			server: {type:"ACS Server"},
			action: { type:"text" }
		}		
	});
}

