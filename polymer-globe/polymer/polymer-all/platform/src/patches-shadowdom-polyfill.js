/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function() {

  // convenient global
  window.wrap = function(n) {
    return n.impl ? n : ShadowDOMPolyfill.wrap(n);
  }
  window.unwrap = function(n){
    return n.impl ? ShadowDOMPolyfill.unwrap(n) : n;
  }

  // getComputedStyle patch to tolerate unwrapped input
  var originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function(n, pseudo) {
    return originalGetComputedStyle.call(window, wrap(n), pseudo);
  };
  
  // users may want to customize other types
  // TODO(sjmiles): 'button' is now supported by ShadowDOMPolyfill, but
  // I've left this code here in case we need to temporarily patch another
  // type
  /*
  (function() {
    var elts = {HTMLButtonElement: 'button'};
    for (var c in elts) {
      window[c] = function() { throw 'Patched Constructor'; };
      window[c].prototype = Object.getPrototypeOf(
          document.createElement(elts[c]));
    }
  })();
  */
 
  // patch in prefixed name
  Object.defineProperties(HTMLElement.prototype, {
    //TODO(sjmiles): review accessor alias with Arv
    webkitShadowRoot: {
      get: function() {
        return this.shadowRoot;
      }
    }
  });

  //TODO(sjmiles): review method alias with Arv
  HTMLElement.prototype.webkitCreateShadowRoot =
      HTMLElement.prototype.createShadowRoot;
})();
