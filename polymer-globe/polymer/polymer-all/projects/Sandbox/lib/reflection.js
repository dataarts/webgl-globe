/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {

function reflect(element, name, meta) {
  return {
    obj: element,
    name: name,
    value: element[name],
    meta: meta && meta[name]
  };
}

function reflectProperty(element, name, meta) {
  try {
    var v = element[name];
    if (v !== null
        && v !== undefined
        && typeof v !== 'function'
        && typeof v !== 'object'
        //&& element.propertyIsEnumerable(k)
        && !reflectProperty.blacklist[name]) {
      var prop = reflect(element, name, meta);
    }
  } catch(x) {
    // squelch
  }
  return prop;   
}

reflectProperty.blacklist = {EVENT_PREFIX: 1, DELEGATES: 1, PUBLISHED: 1,
    INSTANCE_ATTRIBUTES: 1, PolymerBase: 1, STYLE_SCOPE_ATTRIBUTE: 1};

function reflectProperties(element) {
  var props = [];
  if (element) {
    var found = {};
    var p = element.__proto__;
    var meta = element.meta && element.meta.properties;
    while (p && p != HTMLElement.prototype && p != HTMLInputElement.prototype) {
      var k = Object.keys(p);
      k.forEach(function(k) {
        if (found[k]) {
          return;
        }
        var prop = reflectProperty(element, k, meta);
        if (prop) {
          props.push(prop);
          found[k] = true;
        }
      });
      p = p.__proto__;
    }
    //
    var more = [];
    if (!element.firstElementChild) {
      more.push('textContent');
    }
    more.push('id');
    var whitelist = {};
    //
    meta && Object.keys(meta).forEach(function(n) {
      if (!found[n] && more.indexOf(n) === -1) {
        more.push(n);
        whitelist[n] = true;
      }
    });
    //
    more.forEach(function(k) {
      var v = element[k];
      if ((typeof v !== 'function' && typeof v !== 'object') || whitelist[k]) {
        props.push(reflect(element, k, meta));
      }
    });
  }
  return props;
}

function reflectStyles(element, meta) {
  var props = [];
  if (element) {
    var style = element.style;
    Object.keys(meta).forEach(function(name) {
      props.push(reflect(style, name, meta));
    });
  }
  return props;
}

window.Reflection = {
  properties: reflectProperties,
  styles: reflectStyles
};

})();
