console.log("Welcome to GTNexus Chrome Web Extension!");

var isloading = false;
var s = document.createElement("script");
s.src = chrome.runtime.getURL("webextensioncomm.js");
(document.head || document.documentElement).appendChild(s);
s.onload = function () {
  s.parentNode.removeChild(s);
  isloading = true;
};

chrome.runtime.onMessage.addListener(function (message, sender, response) {
  deliverDesktopMsg(message);
});

document.addEventListener("MessageEvent", function (e) {
    // message passing to extension
    try {
      var message = e.detail;
      if (isloading) {
        // loaded flag is important and used to understand the page is loaded/refreshed
        message.loaded = true;
        isloading = false;
        message.init = true;
      }
      chrome.runtime.sendMessage(message);
    } catch (err) {
      var method;
      if (e.detail.bm) {
        method = e.detail.bm;
      } else {
        var json = JSON.parse(e.detail.p);
        method = json.bcmd;
      }

      deliverDesktopMsg({
        m: method,
        cbid: e.detail.cbid,
        errormsg: err.message,
      });
    }

}, false);

function deliverDesktopMsg(message) {
  if (!isloading) {// avoid loading unnecessary messages during page-reload
    document.dispatchEvent(
      new CustomEvent("desktopMessageEvent", {
        detail: message,
      })
    );
  }
}
