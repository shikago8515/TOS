
var WebExtensionCommFn = (function() {
	var instance;

	function createInstance(name) {
		var object = new WebExtensionComm(name);
        return object;
	}
	
	function WebExtensionComm(name) {
		this.appName = name;
		this.appVersion = "0.1.0.0rc0";
		this.config;
		this.currentport;
		
		document.addEventListener("desktopMessageEvent", function(event) {
			var message = event.detail;
			if (message) {
				var method = message.m;
				var callbackId = message.cbid;
				var payload = message.d;
				var callbackMethodName = message.cbmn;
				var errorMsg = message.errormsg;

				if (message.error && message.code && message.code === 'catastrophic') {
					window['webExt_' + this.appName + '_ConnectionError'](message.error.message);
				} else {
					if (! errorMsg && message.error) {
						errorMsg = message.error.message;
					}
					if (message.port) {
						this.currentport = message.port;
					}
					if (errorMsg) {
						window['webExt_' + this.appName + '_ResponseError'](method, errorMsg, callbackId);
					} else {
						if (callbackMethodName === '_Logging') {
							window['webExt_' + this.appName + callbackMethodName](payload);
						} else {
							window['webExt_' + this.appName + callbackMethodName](method, payload, callbackId);
						}
					}
				}
			}
		}.bind(this), false)
	
		this.addConfig = function(host, portStart, portEnd, enabledDebug, pingStream) {
			this.config = {};
			this.config.host = host;
			this.config.portStart = portStart;
			this.config.portEnd = portEnd;
			this.config.enabledDebug = enabledDebug;
			this.config.pingStream = pingStream;
		}
		this.version = function() {
			return this.appVersion;
		}
		this.resetPortSelection = function() {
			document.dispatchEvent(new CustomEvent('MessageEvent', {
				detail: {p: '{"bcmd" : "resetPortSelection"}', c: this.config}
			}));
		}
		this.call = function(method, payload, callbackId) {
			document.dispatchEvent(new CustomEvent('MessageEvent', {
				detail: {p : payload, cbid : callbackId, c : this.config, bm : method}
			}));
		}
		this.getCurrentPort = function() {
			return this.currentport;
		}
		this.ping = function(payload, callbackId) {
			document.dispatchEvent(new CustomEvent('MessageEvent', {
				detail: {p: payload, cbid: callbackId, c: this.config}
			}));
		}
		this.reconnect = function(callbackId) {
			document.dispatchEvent(new CustomEvent('MessageEvent', {
				detail: {p: '{"bcmd" : "reconnect"}', cbid: callbackId, c: this.config}
			}));
		}
	}

	return {
		getInstance: function(name) {
			if (!instance) {
                instance = createInstance(name);
            }
            return instance;
		}
	};
})();

