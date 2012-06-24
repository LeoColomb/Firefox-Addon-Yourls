const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutYourls() { }
AboutYourls.prototype = {
    classDescription: "about:yourls",
    contractID: "@mozilla.org/network/protocol/about;1?what=yourls",
    classID: Components.ID("{f9073c24-dba4-48c4-97ca-1753673d1585}"),
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
  
    getURIFlags: function(aURI) {
        return Ci.nsIAboutModule.ALLOW_SCRIPT;
    },
  
    newChannel: function(aURI) {
        let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        let channel = ios.newChannel("chrome://yourls/content/options.xul",
                                     null, null);
        channel.originalURI = aURI;
        return channel;
    }
};
const NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutYourls]);

function NSGetModule(compMgr, fileSpec)
    XPCOMUtils.generateModule([AboutYourls]);