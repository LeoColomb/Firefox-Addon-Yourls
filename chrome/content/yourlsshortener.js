var YOURLSshortener = function () {
    var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
    return {
        gohome: function () {
            var api = prefManager.getCharPref("extensions.yourls-shortener.api");
            if (api.substr(-1) != '/')
                api += '/';
            openUILinkIn(api + "admin/", "tab");
            return;
        },
        test: function () {
            var api = document.getElementById("api");
            var signature = document.getElementById("signature");
            var maxwait = document.getElementById("maxwait");
            var askforkey = document.getElementById("askforkey");
            var fail = "";

            if (!api || !signature || !maxwait || !askforkey) {
                prompts.alert(null, "YOURLS - Test Error", "A bug occured!\nSorry, please contact the developer.");
                return;
            }

            if (!api.value)
                fail += "Please specify an API-URL!\n";
            else if (!api.value.match(/^http\S+$/))
                fail += "API-URL has to start with http, white-spaces are not allowed!\n";

            if (fail) {
                prompts.alert(null, "YOURLS - Error", "Test failed:\n" + fail);
                return;
            }

            //alert (askforkey.value);
            //alert (maxwait.value);
            var checked = askforkey.checked;
            prefManager.setCharPref("extensions.yourls-shortener.api", api.value);
            prefManager.setCharPref("extensions.yourls-shortener.signature", signature.value);
            prefManager.setBoolPref("extensions.yourls-shortener.askforkey", false);
            prefManager.setIntPref("extensions.yourls-shortener.maxwait", maxwait.value);

            this.run("http://www.google.com/");
            prefManager.setBoolPref("extensions.yourls-shortener.askforkey", checked);
            return;
        },
        run: function (long) {
            if (!long) {
                prompts.alert(null, "YOURLS - Error", "no URL specified!?");
                return;
            }

            if (long != "http://www.google.com/")
                if (!(Services.io.getProtocolFlags(makeURI(long).scheme) & Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE)) {
                    prompts.alert(null, "URL invalid", "This URL is not valid");
                    return;
                }

            var api = prefManager.getCharPref("extensions.yourls-shortener.api");
            if (api.substr(-1) != '/')
                api += '/';
            api += "yourls-api.php";

            if (api && api != "http://yoursite/") {
                try {
                    var params = "action=shorturl&format=simple&url=" + encodeURIComponent(long) + "&signature=" + encodeURIComponent(prefManager.getCharPref("extensions.yourls-shortener.signature"));

                    if (prefManager.getBoolPref("extensions.yourls-shortener.askforkey")) {
                        var sel = "";
                        try {
                            sel = content.getSelection() + "";
                        }
                        catch (e) { }

                        var key = { value: sel };
                        if (prompts.prompt(null, "YOURLS - Keyword", "Custom short URL with keyboard\n- Leave empty to generate -\n\n" + prefManager.getCharPref("extensions.yourls-shortener.api") + "...", key, null, { value: false })) {
                            if (key.value)
                                params += "&keyword=" + encodeURIComponent(key.value);
                        }
                        else
                            return;
                    }

                    var maxwait = 1000 * prefManager.getIntPref("extensions.yourls-shortener.maxwait");
                    if (!maxwait || maxwait < 2000)
                        maxwait = 2000;

                    var request = new XMLHttpRequest();
                    request.open("POST", api, true);
                    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    request.setRequestHeader("Content-length", params.length);
                    request.setRequestHeader("Connection", "close");

                    var requestTimer = setTimeout(function () {
                        request.abort();
                        prompts.alert(null, "YOURLS - Error", "Did not get an answer from server!\nTry again later or increase maximum waiting time.");
                        return;
                    }, maxwait);
                    request.onreadystatechange = function () {
                        if (request.readyState != 4)
                            return;
                        clearTimeout(requestTimer);
                        if ((request.status == 200 || request.status == 201) && request.responseText.match(/^\s*\S+\s*$/)) {
                            prompts.alert(null, "YOURLS - Short URL", long + "\nis shortened by:\n\n" + request.responseText + "\n\nCopied in the clipboard");
                            clipboard.copyString(request.responseText);
                            return;
                        }
                        else if ((request.status == 200 || request.status == 201) && request.responseText.match(/^\s*$/)) {
                            prompts.alert(null, "YOURLS - Error", "Shortening failed.. Maybe chosen key already in use!?\nTry again!");
                            return;
                        }
                        else {
                            prompts.alert(null, "YOURLS - Error", "Do not understand the response from API!\nPlease check your signature and the API-URL.");
                            return;
                        }
                    }

                    request.send(params);
                }
                catch (e) {
                    prompts.alert(null, "YOURLS - Error", "Failed to start XMLHttpRequest:\n" + e.message);
                }

            }
            else
                prompts.alert(null, "YOURLS - Error", "No API-URL specified... Check your settings!");
        }
    };
} ();