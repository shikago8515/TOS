var port = null;
var hostName = "com.gtnexus.packbyscan.chrome_native_bridge";
var debug = false;
var connectionErr = null;

function log(msg) {
  log(msg, false);
}
function log(msg, force) {
  if (debug || force) {
    console.log("Message from background.js: " + msg);
  }
}

// add listener to capture tabs update, and evaluates tab URL to decide disconnect Port or not.
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (
    port &&
    port["tabsId"] === tabId &&
    changeInfo &&
    changeInfo.status === "complete"
  ) {
    // verify whether we have leave the print-scan-ship page or not.
    if (
      !tab.url ||
      (tab.title !== "Print Scan Ship" && !tab.url.includes("PackByScan"))
    ) {
      port.disconnect();
      port = null;
      log("Port is disconnected because URL is not PackByScan", true);
    }
  }
});

function connect() {
  if (!port) {
    port = chrome.runtime.connectNative(hostName);
    port.onMessage.addListener(onNativeMessage);
    port.onDisconnect.addListener(onDisconnected);

    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      function (tabs) {
        if (tabs && tabs[0]) {
          port["tabsId"] = tabs[0].id;
        }
      }
    );

    log("Connected to native messaging host: " + hostName);
  }
}

function deliver(message) {
  log("msg to be delivered to browser from host: " + message);
  var tabId;
  if (message.cbid && port) {
    tabId = port[message.cbid];
  }
  if (!tabId) {
    // no tab reference, just return to the current active one
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0] && tabs[0].title === "Print Scan Ship") {
        chrome.tabs.sendMessage(tabs[0].id, message);
      }
    });
  } else {
    chrome.tabs.sendMessage(tabId, message);
    delete port[message.cbid];
  }
}

function onDisconnected() {
  connectionErr = Object.assign({}, chrome.runtime.lastError);
  deliver({ error: connectionErr, code: "catastrophic" });
  port = null;
  log("Port is disconnected", true);
}

var chunks = [];
function onNativeMessage(message) {
  if (message.chunk_complete && chunks.length > 0) {
    var data = "";
    for (i = 0; i < chunks.length; i++) {
      data += chunks[i].chunk;
    }
    message.d = data;
    chunks = [];
    deliver(message);
  }
  if (message.chunk) {
    // deliver in chunkes..
    chunks.push(message);
  } else {
    deliver(message);
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, responseCallback) {
  if (request.init) {
    connectionErr = null;
  }

  var callbackId = request.cbid;
  var payload = null;
  try {
    payload = JSON.parse(request.p);
  } catch (err) {
    console.log("error passing payload : error is" + err);
  }
  payload.cbid = callbackId;
  payload.config = request.c;
  payload.bm = request.bm;

  debug = payload.config.enabledDebug;

  if (connectionErr && payload.bcmd !== "reconnect") {
    log("onMessage Listener - connection error detected.");
    deliver({ error: connectionErr, code: "catastrophic" });
  } else {
    if (payload.bcmd === "reconnect" && connectionErr) {
      log("Reconnect command issued");
      connectionErr = null;
    }
    if (port && request.loaded) {
      // disgard the current port process since page is reloaded.
      port.disconnect();
      port = undefined;
    }
    if (!port) {
      log("Connecting with bcmd: " + payload.bcmd);
      connect();
      payload.loaded = false;
      log("Connected");
    }

    Object.defineProperty(port, callbackId, {
      configurable: true,
      writeable: false,
      value: sender.tab.id
    });

    if (payload.bpyl) {
      try {
        if (!(payload.bcmd == "gack" || payload.bcmd == "gfin")) {
          payload.bpyl = JSON.parse(payload.bpyl);
        }
      } catch (err) {
        console.log("error caught: " + err);
      }
    }
    log("msg to be sent to host from browser is: " + payload);
    port.postMessage(payload);

    if (chrome.runtime.lastError) {
      chrome.tabs.sendMessage(sender.tab.id, {
        m: payload.bcmd,
        cbid: callbackId,
        errormsg: chrome.runtime.lastError.message,
      });
    }
     }
});
