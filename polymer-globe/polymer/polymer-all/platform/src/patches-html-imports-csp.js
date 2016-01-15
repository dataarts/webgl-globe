/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(scope) {

if (!scope) {
  scope = window.HTMLImports = {flags:{}};
}

// Patches for running in a sandboxed iframe.
// The origin is set to null when we're running in a sandbox, so we
// ask the parent window to fetch the resources.

var xhr = {
  callbacks: {},
  load: function(url, next, nextContext) {
    xhr.callbacks[url] = {
      next: next,
      nextContext: nextContext
    }
    parent.postMessage({
      url: url,
      bust: scope.flags.debug || scope.flags.bust
    }, '*');
  },
  receive: function(url, err, resource) {
    var cb = xhr.callbacks[url];
    if (cb) {
      var next = cb.next;
      var nextContext = cb.nextContext;
      next.call(nextContext, err, resource, url);
    }
  }
};

xhr.loadDocument = xhr.load;

window.addEventListener('message', function(e) {
  xhr.receive(e.data.url, e.data.err, e.data.resource);
});

// exports

scope.xhr = xhr;

})(window.HTMLImports);
