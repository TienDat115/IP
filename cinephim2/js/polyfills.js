// CinePhim - Polyfills for Tizen 2014 Browser (WebKit/ES5)
// This file must be loaded BEFORE any other script.

(function() {
    'use strict';

    // ========== Object.assign ==========
    if (typeof Object.assign !== 'function') {
        Object.assign = function(target) {
            if (target == null) throw new TypeError('Cannot convert undefined or null to object');
            var to = Object(target);
            for (var i = 1; i < arguments.length; i++) {
                var source = arguments[i];
                if (source != null) {
                    for (var key in source) {
                        if (Object.prototype.hasOwnProperty.call(source, key)) {
                            to[key] = source[key];
                        }
                    }
                }
            }
            return to;
        };
    }

    // ========== Array.prototype.find ==========
    if (!Array.prototype.find) {
        Array.prototype.find = function(callback) {
            for (var i = 0; i < this.length; i++) {
                if (callback(this[i], i, this)) return this[i];
            }
            return undefined;
        };
    }

    // ========== Array.prototype.findIndex ==========
    if (!Array.prototype.findIndex) {
        Array.prototype.findIndex = function(callback) {
            for (var i = 0; i < this.length; i++) {
                if (callback(this[i], i, this)) return i;
            }
            return -1;
        };
    }

    // ========== Array.prototype.includes ==========
    if (!Array.prototype.includes) {
        Array.prototype.includes = function(searchElement) {
            var O = Object(this);
            var len = parseInt(O.length) || 0;
            if (len === 0) return false;
            var n = parseInt(arguments[1]) || 0;
            var k;
            if (n >= 0) {
                k = n;
            } else {
                k = len + n;
                if (k < 0) k = 0;
            }
            while (k < len) {
                if (O[k] === searchElement) return true;
                k++;
            }
            return false;
        };
    }

    // ========== Array.prototype.map ==========
    if (!Array.prototype.map) {
        Array.prototype.map = function(callback) {
            var result = [];
            for (var i = 0; i < this.length; i++) {
                if (i in this) result.push(callback(this[i], i, this));
            }
            return result;
        };
    }

    // ========== Array.prototype.filter ==========
    if (!Array.prototype.filter) {
        Array.prototype.filter = function(callback) {
            var result = [];
            for (var i = 0; i < this.length; i++) {
                if (i in this && callback(this[i], i, this)) result.push(this[i]);
            }
            return result;
        };
    }

    // ========== Array.prototype.forEach ==========
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function(callback) {
            for (var i = 0; i < this.length; i++) {
                if (i in this) callback(this[i], i, this);
            }
        };
    }

    // ========== Array.prototype.reduce ==========
    if (!Array.prototype.reduce) {
        Array.prototype.reduce = function(callback, initialValue) {
            var len = this.length;
            var k = 0;
            var value;
            if (arguments.length >= 2) {
                value = initialValue;
            } else {
                while (k < len && !(k in this)) k++;
                if (k >= len) throw new TypeError('Reduce of empty array with no initial value');
                value = this[k++];
            }
            for (; k < len; k++) {
                if (k in this) value = callback(value, this[k], k, this);
            }
            return value;
        };
    }

    // ========== Array.prototype.some ==========
    if (!Array.prototype.some) {
        Array.prototype.some = function(callback) {
            for (var i = 0; i < this.length; i++) {
                if (i in this && callback(this[i], i, this)) return true;
            }
            return false;
        };
    }

    // ========== Array.prototype.every ==========
    if (!Array.prototype.every) {
        Array.prototype.every = function(callback) {
            for (var i = 0; i < this.length; i++) {
                if (i in this && !callback(this[i], i, this)) return false;
            }
            return true;
        };
    }

    // ========== Array.from ==========
    if (!Array.from) {
        Array.from = function(arrayLike) {
            var result = [];
            for (var i = 0; i < arrayLike.length; i++) {
                result.push(arrayLike[i]);
            }
            return result;
        };
    }

    // ========== String.prototype.startsWith ==========
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function(search) {
            return this.indexOf(search) === 0;
        };
    }

    // ========== String.prototype.endsWith ==========
    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function(search) {
            return this.indexOf(search, this.length - search.length) !== -1;
        };
    }

    // ========== String.prototype.includes ==========
    if (!String.prototype.includes) {
        String.prototype.includes = function(search) {
            return this.indexOf(search) !== -1;
        };
    }

    // ========== String.prototype.trim ==========
    if (!String.prototype.trim) {
        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g, '');
        };
    }

    // ========== String.prototype.padStart ==========
    if (!String.prototype.padStart) {
        String.prototype.padStart = function(targetLength, padString) {
            targetLength = targetLength >> 0;
            padString = String(padString || ' ');
            if (this.length >= targetLength) return String(this);
            targetLength = targetLength - this.length;
            var pad = '';
            while (pad.length < targetLength) {
                pad += padString;
            }
            return pad.slice(0, targetLength) + String(this);
        };
    }

    // ========== Promise ==========
    if (typeof Promise === 'undefined') {
        var PromisePolyfill = function(executor) {
            var self = this;
            self._state = 'pending';
            self._value = undefined;
            self._handlers = [];

            function resolve(value) {
                if (self._state !== 'pending') return;
                self._state = 'fulfilled';
                self._value = value;
                self._handlers.forEach(function(h) { h.onFulfilled(value); });
            }

            function reject(reason) {
                if (self._state !== 'pending') return;
                self._state = 'rejected';
                self._value = reason;
                self._handlers.forEach(function(h) { h.onRejected(reason); });
            }

            try {
                executor(resolve, reject);
            } catch (e) {
                reject(e);
            }
        };

        PromisePolyfill.prototype.then = function(onFulfilled, onRejected) {
            var self = this;
            return new PromisePolyfill(function(resolve, reject) {
                function handle(fn, fallback) {
                    return function(value) {
                        try {
                            var result = typeof fn === 'function' ? fn(value) : fallback(value);
                            if (result && typeof result.then === 'function') {
                                result.then(resolve, reject);
                            } else {
                                resolve(result);
                            }
                        } catch (e) {
                            reject(e);
                        }
                    };
                }
                var fulfilled = handle(onFulfilled, function(v) { return v; });
                var rejected = handle(onRejected, function(v) { throw v; });

                if (self._state === 'fulfilled') { setTimeout(function() { fulfilled(self._value); }, 0); }
                else if (self._state === 'rejected') { setTimeout(function() { rejected(self._value); }, 0); }
                else { self._handlers.push({ onFulfilled: fulfilled, onRejected: rejected }); }
            });
        };

        PromisePolyfill.prototype['catch'] = function(onRejected) {
            return this.then(null, onRejected);
        };

        PromisePolyfill.prototype['finally'] = function(callback) {
            return this.then(
                function(value) { return PromisePolyfill.resolve(callback()).then(function() { return value; }); },
                function(reason) { return PromisePolyfill.resolve(callback()).then(function() { throw reason; }); }
            );
        };

        PromisePolyfill.resolve = function(value) {
            if (value instanceof PromisePolyfill) return value;
            return new PromisePolyfill(function(resolve) { resolve(value); });
        };

        PromisePolyfill.reject = function(reason) {
            return new PromisePolyfill(function(_, reject) { reject(reason); });
        };

        PromisePolyfill.all = function(arr) {
            return new PromisePolyfill(function(resolve, reject) {
                if (!arr || arr.length === 0) return resolve([]);
                var count = arr.length;
                var results = [];
                arr.forEach(function(p, i) {
                    PromisePolyfill.resolve(p).then(function(val) {
                        results[i] = val;
                        if (--count === 0) resolve(results);
                    }, reject);
                });
            });
        };

        PromisePolyfill.race = function(arr) {
            return new PromisePolyfill(function(resolve, reject) {
                arr.forEach(function(p) {
                    PromisePolyfill.resolve(p).then(resolve, reject);
                });
            });
        };

        // Polyfill Promise.allSettled
        PromisePolyfill.allSettled = function(arr) {
            return PromisePolyfill.all(arr.map(function(p) {
                return PromisePolyfill.resolve(p).then(
                    function(value) { return { status: 'fulfilled', value: value }; },
                    function(reason) { return { status: 'rejected', reason: reason }; }
                );
            }));
        };

        window.Promise = PromisePolyfill;
    }

    // ========== Map ==========
    if (typeof Map === 'undefined') {
        window.Map = function() {
            this._keys = [];
            this._values = [];
            this.size = 0;
        };
        Map.prototype.set = function(key, value) {
            var idx = this._keys.indexOf(key);
            if (idx === -1) {
                this._keys.push(key);
                this._values.push(value);
                this.size++;
            } else {
                this._values[idx] = value;
            }
            return this;
        };
        Map.prototype.get = function(key) {
            var idx = this._keys.indexOf(key);
            return idx === -1 ? undefined : this._values[idx];
        };
        Map.prototype.has = function(key) {
            return this._keys.indexOf(key) !== -1;
        };
        Map.prototype['delete'] = function(key) {
            var idx = this._keys.indexOf(key);
            if (idx !== -1) {
                this._keys.splice(idx, 1);
                this._values.splice(idx, 1);
                this.size--;
                return true;
            }
            return false;
        };
        Map.prototype.forEach = function(callback) {
            for (var i = 0; i < this._keys.length; i++) {
                callback(this._values[i], this._keys[i], this);
            }
        };
        Map.prototype.clear = function() {
            this._keys = [];
            this._values = [];
            this.size = 0;
        };
    }

    // ========== Set ==========
    if (typeof Set === 'undefined') {
        window.Set = function() {
            this._map = new Map();
        };
        Set.prototype.add = function(value) {
            this._map.set(value, value);
            return this;
        };
        Set.prototype.has = function(value) {
            return this._map.has(value);
        };
        Set.prototype['delete'] = function(value) {
            return this._map['delete'](value);
        };
        Set.prototype.forEach = function(callback) {
            this._map.forEach(function(val) { callback(val); });
        };
        Object.defineProperty(Set.prototype, 'size', {
            get: function() { return this._map.size; }
        });
    }

    // ========== fetch ==========
    if (typeof fetch === 'undefined') {
        window.fetch = function(url, options) {
            return new Promise(function(resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open((options && options.method) || 'GET', url, true);
                if (options && options.headers) {
                    var headers = options.headers;
                    for (var key in headers) {
                        if (headers.hasOwnProperty(key)) {
                            xhr.setRequestHeader(key, headers[key]);
                        }
                    }
                }
                xhr.onload = function() {
                    resolve({
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        json: function() {
                            return new Promise(function(res, rej) {
                                try {
                                    res(JSON.parse(xhr.responseText));
                                } catch (e) {
                                    rej(e);
                                }
                            });
                        },
                        text: function() {
                            return new Promise(function(res) { res(xhr.responseText); });
                        }
                    });
                };
                xhr.onerror = function() { reject(new Error('Network error')); };
                xhr.send(options && options.body ? options.body : null);
            });
        };
    }

    // ========== URL ==========
    if (typeof URL === 'undefined') {
        window.URL = function(url, base) {
            if (base) {
                // Simple base URL resolution
                if (url.indexOf('http') !== 0) {
                    url = base.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
                }
            }
            this.href = url;
            try {
                var match = url.match(/^(https?:\/\/[^\/]+)(\/[^\?]*)?(\?[^#]*)?(#.*)?$/);
                this.protocol = match ? match[1].split(':')[0] + ':' : '';
                this.hostname = match ? match[1].replace(/^https?:\/\//, '') : '';
                this.pathname = match && match[2] ? match[2] : '/';
                this.search = match && match[3] ? match[3] : '';
                this.hash = match && match[4] ? match[4] : '';
            } catch (e) {
                this.protocol = '';
                this.hostname = '';
                this.pathname = url;
                this.search = '';
                this.hash = '';
            }
            this.searchParams = new URLSearchParams(this.search);
        };
        window.URL.prototype.toString = function() {
            return this.href;
        };
    }

    // ========== URLSearchParams ==========
    if (typeof URLSearchParams === 'undefined') {
        window.URLSearchParams = function(init) {
            this._params = [];
            if (typeof init === 'string') {
                init = init.replace(/^\?/, '');
                if (init) {
                    var pairs = init.split('&');
                    for (var i = 0; i < pairs.length; i++) {
                        var pair = pairs[i].split('=');
                        this._params.push([decodeURIComponent(pair[0]), decodeURIComponent(pair[1] || '')]);
                    }
                }
            }
        };
        URLSearchParams.prototype.get = function(name) {
            for (var i = 0; i < this._params.length; i++) {
                if (this._params[i][0] === name) return this._params[i][1];
            }
            return null;
        };
        URLSearchParams.prototype.set = function(name, value) {
            for (var i = 0; i < this._params.length; i++) {
                if (this._params[i][0] === name) {
                    this._params[i][1] = value;
                    return;
                }
            }
            this._params.push([name, value]);
        };
        URLSearchParams.prototype['delete'] = function(name) {
            this._params = this._params.filter(function(p) { return p[0] !== name; });
        };
        URLSearchParams.prototype.has = function(name) {
            return this.get(name) !== null;
        };
        URLSearchParams.prototype.toString = function() {
            var pairs = [];
            for (var i = 0; i < this._params.length; i++) {
                pairs.push(encodeURIComponent(this._params[i][0]) + '=' + encodeURIComponent(this._params[i][1]));
            }
            return pairs.join('&');
        };
    }

    // ========== CustomEvent ==========
    if (typeof CustomEvent === 'undefined') {
        window.CustomEvent = function(type, params) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
            return evt;
        };
    }

    // ========== Event.prototype.key (polyfill for KeyboardEvent) ==========
    // Ensure key property exists on keyboard events
    (function() {
        var keys = { 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter', 27: 'Escape', 32: ' ' };
        if (typeof KeyboardEvent !== 'undefined' && !('key' in KeyboardEvent.prototype)) {
            // Cannot easily polyfill, but at least provide alternative
        }
    })();

    // ========== Element.prototype.closest ==========
    if (!Element.prototype.closest) {
        Element.prototype.closest = function(selector) {
            var el = this;
            while (el && el !== document) {
                if (el.matches(selector)) return el;
                el = el.parentElement || el.parentNode;
            }
            return null;
        };
    }

    // ========== Element.prototype.matches ==========
    if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    }

    // ========== NodeList.prototype.forEach ==========
    if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = Array.prototype.forEach;
    }

    // ========== requestAnimationFrame ==========
    if (typeof requestAnimationFrame === 'undefined') {
        window.requestAnimationFrame = function(callback) {
            return setTimeout(callback, 16);
        };
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }

    // ========== Date.now ==========
    if (!Date.now) {
        Date.now = function() { return new Date().getTime(); };
    }

    // ========== encodeURIComponent / decodeURIComponent are native ==========

})();
