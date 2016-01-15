// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(scope) {

  'use strict';

  // polyfill DOMTokenList
  // * add/remove: allow these methods to take multiple classNames
  // * toggle: add a 2nd argument which forces the given state rather
  //  than toggling.

  var add = DOMTokenList.prototype.add;
  var remove = DOMTokenList.prototype.remove;
  DOMTokenList.prototype.add = function() {
    for (var i = 0; i < arguments.length; i++) {
      add.call(this, arguments[i]);
    }
  };
  DOMTokenList.prototype.remove = function() {
    for (var i = 0; i < arguments.length; i++) {
      remove.call(this, arguments[i]);
    }
  };
  DOMTokenList.prototype.toggle = function(name, bool) {
    if (arguments.length == 1) {
      bool = !this.contains(name);
    }
    bool ? this.add(name) : this.remove(name);
  };
  DOMTokenList.prototype.switch = function(oldName, newName) {
    oldName && this.remove(oldName);
    newName && this.add(newName);
  };
  
  // add array() and forEach() to NodeList, NamedNodeMap, HTMLCollection

  var ArraySlice = function() {
    return Array.prototype.slice.call(this);
  };

  var namedNodeMap = (window.NamedNodeMap || window.MozNamedAttrMap || {});
  
  NodeList.prototype.array = ArraySlice;
  namedNodeMap.prototype.array = ArraySlice;
  HTMLCollection.prototype.array = ArraySlice;

  var ArrayForEach = function(cb, context) {
    ArraySlice.call(this).forEach(cb, context);
  };

  NodeList.prototype.forEach = ArrayForEach;
  namedNodeMap.prototype.forEach = ArrayForEach;
  HTMLCollection.prototype.forEach = ArrayForEach;

  // polyfill performance.now

  if (!window.performance) {
    var start = Date.now();
    // only at millisecond precision
    window.performance = {now: function(){ return Date.now() - start }};
  }

  // polyfill for requestAnimationFrame

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (function() {
      var nativeRaf = window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame;

      return nativeRaf ?
        function(callback) {
          return nativeRaf(function() {
            callback(performance.now());
          });
        } :
        function( callback ){
          return window.setTimeout(callback, 1000 / 60);
        };
    })();
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (function() {
      return  window.webkitCancelAnimationFrame ||
        window.mozCancelAnimationFrame ||
        function(id) {
          clearTimeout(id);
        };
    })();
  }

  // utility

  function createDOM(inTagOrNode, inHTML, inAttrs) {
    var dom = typeof inTagOrNode == 'string' ? 
        document.createElement(inTagOrNode) : inTagOrNode.cloneNode(true);
    dom.innerHTML = inHTML;
    if (inAttrs) {
      for (var n in inAttrs) {
        dom.setAttribute(n, inAttrs[n]);
      }
    }
    return dom;
  }

  // exports

  scope.createDOM = createDOM;

})(window.Platform);
