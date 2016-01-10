/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {
 function getBinding(element, name) {
    if (element && element.bindings) {
      var binding = element.bindings[name];
      if (binding) {
        return binding.path;
      }
    }
  }
 
  
  window.Bindings = {
    getBinding: getBinding
  }
})();
