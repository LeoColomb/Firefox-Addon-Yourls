var Yourls = function () {
    var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
    return {
        gohome: function () {
            var api = prefManager.getCharPref("extensions.yourls.api");
            if (api.substr(-1) != '/')
                api += '/';
            if ((prefManager.getBoolPref("extensions.yourls.ssl")) && (api.substr(4, 1) != 's'))
                api = "https" + api.substr(4);
            openUILinkIn(api + "admin/", "tab");
            return;
        },
        test: function () {
            var api = document.getElementById("api");
            var signature = document.getElementById("signature");
            var maxwait = document.getElementById("maxwait");
            var askforkey = document.getElementById("askforkey");
            var timestamp = document.getElementById("timestamp");
            var fail = "";

            if (!api || !signature || !maxwait || !askforkey || !timestamp) {
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
            var checkedAsk = askforkey.checked;
            var checkedTime = timestamp.checked;
            prefManager.setCharPref("extensions.yourls.api", api.value);
            prefManager.setCharPref("extensions.yourls.signature", signature.value);
            prefManager.setBoolPref("extensions.yourls.askforkey", false);
            prefManager.setBoolPref("extensions.yourls.timestamp", false);
            prefManager.setIntPref("extensions.yourls.maxwait", maxwait.value);

            this.run("http://www.google.com/");
            prefManager.setBoolPref("extensions.yourls.askforkey", checkedAsk);
            prefManager.setBoolPref("extensions.yourls.timestamp", checkedTime);
            return;
        },
        run: function (long, title) {
            var timerSmaller = false;
            if (!long) {
                prompts.alert(null, "YOURLS - Error", "no URL specified!?");
                return;
            }

            if (long != "http://www.google.com/")
                if (!(Services.io.getProtocolFlags(makeURI(long).scheme) & Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE)) {
                    prompts.alert(null, "YOURLS - Warning", "This URL is not valid");
                    return;
                }

            var api = prefManager.getCharPref("extensions.yourls.api");
            if (api.substr(-1) != '/')
                api += '/';
            api += "yourls-api.php";

            if (api && api != "http://yoursite/") {
                try {
                    if (prefManager.getBoolPref("extensions.yourls.timestamp")) {
                        var timestamp = Math.round( new Date().getTime() / 1000 );
                        var signature = encodeURIComponent(this.hash(timestamp + prefManager.getCharPref("extensions.yourls.signature")));
                        signature += "&timestamp=" + timestamp;
                    }
                    else {
                        var signature = encodeURIComponent(prefManager.getCharPref("extensions.yourls.signature"));
                    }
                    var params = "action=shorturl&format=simple&url=" + encodeURIComponent(long) + "&signature=" + signature;

                    if (prefManager.getBoolPref("extensions.yourls.askforkey")) {
                        var sel = "";
                        try {
                            sel = content.getSelection() + "";
                        }
                        catch (e) { }

                        var key = { value: sel };
                        if (prompts.prompt(null, "YOURLS - Keyword", "\"" + title + "\" URL will be shortened!\nCustom short URL with keyboard\n - leave empty to generate -\n\n" + prefManager.getCharPref("extensions.yourls.api") + "/...", key, null, { value: false })) {
                            if (key.value)
                                params += "&keyword=" + encodeURIComponent(key.value);
                        }
                        else
                            return;
                    }

                    prompts.alert(null, "YOURLS - Debug", api + "?" + params);

                    var maxwait = 1000 * prefManager.getIntPref("extensions.yourls.maxwait");
                    if (!maxwait || maxwait < 2000)
                        maxwait = 2000;

                    var request = new XMLHttpRequest();
                    request.open("POST", api, true);
                    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    request.setRequestHeader("Content-length", params.length);
                    request.setRequestHeader("Connection", "close");

                    var requestTimer = setTimeout(function () {
                        request.abort();
                        var timerSmaller = true;
                        return;
                    }, maxwait);
                    request.onreadystatechange = function () {
                        if (request.readyState != 4)
                            return;
                        clearTimeout(requestTimer);
                        if ((request.status == 200 || request.status == 201) && request.responseText.match(/^\s*\S+\s*$/)) {
                            clipboard.copyString(request.responseText);
                            prompts.alert(null, "YOURLS - Short URL", title + " is shortened!\n\n" + String.fromCharCode(8594) + " " + request.responseText + "\n - copied in clipboard - ");
                            return;
                        }
                        else if ((request.status == 200 || request.status == 201) && request.responseText.match(/^\s*$/)) {
                            prompts.alert(null, "YOURLS - Error", "Shortening failed... Maybe chosen key already in use!?\nTry again!");
                            return;
                        }
                        else if (timerSmaller) {
                            prompts.alert(null, "YOURLS - Error", "Do not understand the response from API!\nPlease check your signature and the API-URL.\n\nDebug info: " + request.status);
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
        },
        hash: function (string, key, raw) {
            /*
            * JavaScript MD5 1.0
            * https://github.com/blueimp/JavaScript-MD5
            *
            * Copyright 2011, Sebastian Tschan
            * https://blueimp.net
            *
            * Licensed under the MIT license:
            * http://www.opensource.org/licenses/MIT
            *
            * Based on
            * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
            * Digest Algorithm, as defined in RFC 1321.
            * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
            * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
            * Distributed under the BSD License
            * See http://pajhome.org.uk/crypt/md5 for more info.
            */

            /*jslint bitwise: true */
            /*global unescape, define */
            'use strict';

            /*
        * Add integers, wrapping at 2^32. This uses 16-bit operations internally
        * to work around bugs in some JS interpreters.
        */
            function safe_add(x, y) {
                var lsw = (x & 0xFFFF) + (y & 0xFFFF),
                    msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                return (msw << 16) | (lsw & 0xFFFF);
            }

            /*
        * Bitwise rotate a 32-bit number to the left.
        */
            function bit_rol(num, cnt) {
                return (num << cnt) | (num >>> (32 - cnt));
            }

            /*
        * These functions implement the four basic operations the algorithm uses.
        */
            function md5_cmn(q, a, b, x, s, t) {
                return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
            }
            function md5_ff(a, b, c, d, x, s, t) {
                return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
            }
            function md5_gg(a, b, c, d, x, s, t) {
                return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
            }
            function md5_hh(a, b, c, d, x, s, t) {
                return md5_cmn(b ^ c ^ d, a, b, x, s, t);
            }
            function md5_ii(a, b, c, d, x, s, t) {
                return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
            }

            /*
        * Calculate the MD5 of an array of little-endian words, and a bit length.
        */
            function binl_md5(x, len) {
                /* append padding */
                x[len >> 5] |= 0x80 << ((len) % 32);
                x[(((len + 64) >>> 9) << 4) + 14] = len;

                var i, olda, oldb, oldc, oldd,
                    a = 1732584193,
                    b = -271733879,
                    c = -1732584194,
                    d = 271733878;

                for (i = 0; i < x.length; i += 16) {
                    olda = a;
                    oldb = b;
                    oldc = c;
                    oldd = d;

                    a = md5_ff(a, b, c, d, x[i], 7, -680876936);
                    d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
                    c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
                    b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
                    a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
                    d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
                    c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
                    b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
                    a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
                    d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
                    c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
                    b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
                    a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
                    d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
                    c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
                    b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

                    a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
                    d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
                    c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
                    b = md5_gg(b, c, d, a, x[i], 20, -373897302);
                    a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
                    d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
                    c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
                    b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
                    a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
                    d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
                    c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
                    b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
                    a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
                    d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
                    c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
                    b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

                    a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
                    d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
                    c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
                    b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
                    a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
                    d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
                    c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
                    b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
                    a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
                    d = md5_hh(d, a, b, c, x[i], 11, -358537222);
                    c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
                    b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
                    a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
                    d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
                    c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
                    b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

                    a = md5_ii(a, b, c, d, x[i], 6, -198630844);
                    d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
                    c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
                    b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
                    a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
                    d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
                    c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
                    b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
                    a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
                    d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
                    c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
                    b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
                    a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
                    d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
                    c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
                    b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

                    a = safe_add(a, olda);
                    b = safe_add(b, oldb);
                    c = safe_add(c, oldc);
                    d = safe_add(d, oldd);
                }
                return [a, b, c, d];
            }

            /*
        * Convert an array of little-endian words to a string
        */
            function binl2rstr(input) {
                var i,
                    output = '';
                for (i = 0; i < input.length * 32; i += 8) {
                    output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
                }
                return output;
            }

            /*
        * Convert a raw string to an array of little-endian words
        * Characters >255 have their high-byte silently ignored.
        */
            function rstr2binl(input) {
                var i,
                    output = [];
                output[(input.length >> 2) - 1] = undefined;
                for (i = 0; i < output.length; i += 1) {
                    output[i] = 0;
                }
                for (i = 0; i < input.length * 8; i += 8) {
                    output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
                }
                return output;
            }

            /*
        * Calculate the MD5 of a raw string
        */
            function rstr_md5(s) {
                return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
            }

            /*
        * Calculate the HMAC-MD5, of a key and some data (raw strings)
        */
            function rstr_hmac_md5(key, data) {
                var i,
                    bkey = rstr2binl(key),
                    ipad = [],
                    opad = [],
                    hash;
                ipad[15] = opad[15] = undefined;
                if (bkey.length > 16) {
                    bkey = binl_md5(bkey, key.length * 8);
                }
                for (i = 0; i < 16; i += 1) {
                    ipad[i] = bkey[i] ^ 0x36363636;
                    opad[i] = bkey[i] ^ 0x5C5C5C5C;
                }
                hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
                return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
            }

            /*
        * Convert a raw string to a hex string
        */
            function rstr2hex(input) {
                var hex_tab = '0123456789abcdef',
                    output = '',
                    x,
                    i;
                for (i = 0; i < input.length; i += 1) {
                    x = input.charCodeAt(i);
                    output += hex_tab.charAt((x >>> 4) & 0x0F) +
                        hex_tab.charAt(x & 0x0F);
                }
                return output;
            }

            /*
        * Encode a string as utf-8
        */
            function str2rstr_utf8(input) {
                return unescape(encodeURIComponent(input));
            }

            /*
        * Take string arguments and return either raw or hex encoded strings
        */
            function raw_md5(s) {
                return rstr_md5(str2rstr_utf8(s));
            }
            function hex_md5(s) {
                return rstr2hex(raw_md5(s));
            }
            function raw_hmac_md5(k, d) {
                return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d));
            }
            function hex_hmac_md5(k, d) {
                return rstr2hex(raw_hmac_md5(k, d));
            }

            if (!key) {
                if (!raw) {
                    return hex_md5(string);
                }
                return raw_md5(string);
            }
            if (!raw) {
                return hex_hmac_md5(key, string);
            }
            return raw_hmac_md5(key, string);


            if (typeof define === 'function' && define.amd) {
                define(function () {
                    return md5;
                });
            } else {
                $.md5 = md5;
            }
        }
    };
}();