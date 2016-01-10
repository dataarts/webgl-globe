/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * Implements `document.register`
 * @module CustomElements
*/

/**
 * Polyfilled extensions to the `document` object.
 * @class Document
*/

(function(scope) {

if (!scope) {
  scope = window.CustomElements = {flags:{}};
}

// native document.register?

scope.hasNative = (document.webkitRegister || document.register) && scope.flags.register === 'native';
if (scope.hasNative) {

  // normalize
  document.register = document.register || document.webkitRegister;

  var nop = function() {};

  // exports
  scope.registry = {};
  scope.upgradeElement = nop;

} else {

/**
 * Registers a custom tag name with the document.
 *
 * When a registered element is created, a `readyCallback` method is called
 * in the scope of the element. The `readyCallback` method can be specified on
 * either `inOptions.prototype` or `inOptions.lifecycle` with the latter taking
 * precedence.
 *
 * @method register
 * @param {String} inName The tag name to register. Must include a dash ('-'),
 *    for example 'x-component'.
 * @param {Object} inOptions
 *    @param {String} [inOptions.extends]
 *      (_off spec_) Tag name of an element to extend (or blank for a new
 *      element). This parameter is not part of the specification, but instead
 *      is a hint for the polyfill because the extendee is difficult to infer.
 *      Remember that the input prototype must chain to the extended element's
 *      prototype (or HTMLElement.prototype) regardless of the value of
 *      `extends`.
 *    @param {Object} inOptions.prototype The prototype to use for the new
 *      element. The prototype must inherit from HTMLElement.
 *    @param {Object} [inOptions.lifecycle]
 *      Callbacks that fire at important phases in the life of the custom
 *      element.
 *
 * @example
 *      FancyButton = document.register("fancy-button", {
 *        extends: 'button',
 *        prototype: Object.create(HTMLButtonElement.prototype, {
 *          readyCallback: {
 *            value: function() {
 *              console.log("a fancy-button was created",
 *            }
 *          }
 *        })
 *      });
 * @return {Function} Constructor for the newly registered type.
 */
function register(inName, inOptions) {
  //console.warn('document.register("' + inName + '", ', inOptions, ')');
  // construct a defintion out of options
  // TODO(sjmiles): probably should clone inOptions instead of mutating it
  var definition = inOptions || {};
  if (!inName) {
    // TODO(sjmiles): replace with more appropriate error (Erik can probably
    // offer guidance)
    throw new Error('Name argument must not be empty');
  }
  // record name
  definition.name = inName;
  // must have a prototype, default to an extension of HTMLElement
  // TODO(sjmiles): probably should throw if no prototype, check spec
  if (!definition.prototype) {
    // TODO(sjmiles): replace with more appropriate error (Erik can probably
    // offer guidance)
    throw new Error('Options missing required prototype property');
  }
  // ensure a lifecycle object so we don't have to null test it
  definition.lifecycle = definition.lifecycle || {};
  // build a list of ancestral custom elements (for native base detection)
  // TODO(sjmiles): we used to need to store this, but current code only
  // uses it in 'resolveTagName': it should probably be inlined
  definition.ancestry = ancestry(definition.extends);
  // extensions of native specializations of HTMLElement require localName
  // to remain native, and use secondary 'is' specifier for extension type
  resolveTagName(definition);
  // some platforms require modifications to the user-supplied prototype
  // chain
  resolvePrototypeChain(definition);
  // overrides to implement attributeChanged callback
  overrideAttributeApi(definition.prototype);
  // 7.1.5: Register the DEFINITION with DOCUMENT
  registerDefinition(inName, definition);
  // 7.1.7. Run custom element constructor generation algorithm with PROTOTYPE
  // 7.1.8. Return the output of the previous step.
  definition.ctor = generateConstructor(definition);
  definition.ctor.prototype = definition.prototype;
  // force our .constructor to be our actual constructor
  definition.prototype.constructor = definition.ctor;
  // if initial parsing is complete
  if (scope.ready) {
    // upgrade any pre-existing nodes of this type
    scope.upgradeAll(document);
  }
  return definition.ctor;
}

function ancestry(inExtends) {
  var extendee = registry[inExtends];
  if (extendee) {
    return ancestry(extendee.extends).concat([extendee]);
  }
  return [];
}

function resolveTagName(inDefinition) {
  // if we are explicitly extending something, that thing is our
  // baseTag, unless it represents a custom component
  var baseTag = inDefinition.extends;
  // if our ancestry includes custom components, we only have a
  // baseTag if one of them does
  for (var i=0, a; (a=inDefinition.ancestry[i]); i++) {
    baseTag = a.is && a.tag;
  }
  // our tag is our baseTag, if it exists, and otherwise just our name
  inDefinition.tag = baseTag || inDefinition.name;
  if (baseTag) {
    // if there is a base tag, use secondary 'is' specifier
    inDefinition.is = inDefinition.name;
  }
}

function resolvePrototypeChain(inDefinition) {
  // if we don't support __proto__ we need to locate the native level
  // prototype for precise mixing in
  if (!Object.__proto__) {
    // default prototype
    var native = HTMLElement.prototype;
    // work out prototype when using type-extension
    if (inDefinition.is) {
      var inst = document.createElement(inDefinition.tag);
      native = Object.getPrototypeOf(inst);
    }
  }
  // cache this in case of mixin
  inDefinition.native = native;
}

// SECTION 4

function instantiate(inDefinition) {
  // 4.a.1. Create a new object that implements PROTOTYPE
  // 4.a.2. Let ELEMENT by this new object
  //
  // the custom element instantiation algorithm must also ensure that the
  // output is a valid DOM element with the proper wrapper in place.
  //
  return upgrade(domCreateElement(inDefinition.tag), inDefinition);
}

function upgrade(inElement, inDefinition) {
  // some definitions specify an 'is' attribute
  if (inDefinition.is) {
    inElement.setAttribute('is', inDefinition.is);
  }
  // make 'element' implement inDefinition.prototype
  implement(inElement, inDefinition);
  // flag as upgraded
  inElement.__upgraded__ = true;
  // there should never be a shadow root on inElement at this point
  // we require child nodes be upgraded before ready
  scope.upgradeSubtree(inElement);
  // lifecycle management
  ready(inElement);
  // OUTPUT
  return inElement;
}

function implement(inElement, inDefinition) {
  // prototype swizzling is best
  if (Object.__proto__) {
    inElement.__proto__ = inDefinition.prototype;
  } else {
    // where above we can re-acquire inPrototype via
    // getPrototypeOf(Element), we cannot do so when
    // we use mixin, so we install a magic reference
    customMixin(inElement, inDefinition.prototype, inDefinition.native);
    inElement.__proto__ = inDefinition.prototype;
  }
}

function customMixin(inTarget, inSrc, inNative) {
  // TODO(sjmiles): 'used' allows us to only copy the 'youngest' version of
  // any property. This set should be precalculated. We also need to
  // consider this for supporting 'super'.
  var used = {};
  // start with inSrc
  var p = inSrc;
  // sometimes the default is HTMLUnknownElement.prototype instead of
  // HTMLElement.prototype, so we add a test
  // the idea is to avoid mixing in native prototypes, so adding
  // the second test is WLOG
  while (p !== inNative && p !== HTMLUnknownElement.prototype) {
    var keys = Object.getOwnPropertyNames(p);
    for (var i=0, k; k=keys[i]; i++) {
      if (!used[k]) {
        Object.defineProperty(inTarget, k,
            Object.getOwnPropertyDescriptor(p, k));
        used[k] = 1;
      }
    }
    p = Object.getPrototypeOf(p);
  }
}

function ready(inElement) {
  // invoke readyCallback
  if (inElement.readyCallback) {
    inElement.readyCallback();
  }
}

// attribute watching

function overrideAttributeApi(prototype) {
  // overrides to implement callbacks
  // TODO(sjmiles): should support access via .attributes NamedNodeMap
  // TODO(sjmiles): preserves user defined overrides, if any
  var setAttribute = prototype.setAttribute;
  prototype.setAttribute = function(name, value) {
    changeAttribute.call(this, name, value, setAttribute);
  }
  var removeAttribute = prototype.removeAttribute;
  prototype.removeAttribute = function(name, value) {
    changeAttribute.call(this, name, value, removeAttribute);
  }
}

function changeAttribute(name, value, operation) {
  var oldValue = this.getAttribute(name);
  operation.apply(this, arguments);
  if (this.attributeChangedCallback 
      && (this.getAttribute(name) !== oldValue)) {
    this.attributeChangedCallback(name, oldValue);
  }
}

// element registry (maps tag names to definitions)

var registry = {};

function registerDefinition(inName, inDefinition) {
  registry[inName] = inDefinition;
}

function generateConstructor(inDefinition) {
  return function() {
    return instantiate(inDefinition);
  };
}

function createElement(inTag) {
  var definition = registry[inTag];
  if (definition) {
    return new definition.ctor();
  }
  return domCreateElement(inTag);
}

function upgradeElement(inElement) {
  if (!inElement.__upgraded__ && (inElement.nodeType === Node.ELEMENT_NODE)) {
    var type = inElement.getAttribute('is') || inElement.localName;
    var definition = registry[type];
    return definition && upgrade(inElement, definition);
  }
}

function cloneNode(deep) {
  // call original clone
  var n = domCloneNode.call(this, deep);
  // upgrade the element and subtree
  scope.upgradeAll(n);
  return n;
}
// capture native createElement before we override it

var domCreateElement = document.createElement.bind(document);

// capture native cloneNode before we override it

var domCloneNode = Node.prototype.cloneNode;

// exports

document.register = register;
document.createElement = createElement; // override
Node.prototype.cloneNode = cloneNode; // override

scope.registry = registry;

/**
 * Upgrade an element to a custom element. Upgrading an element
 * causes the custom prototype to be applied, an `is` attribute 
 * to be attached (as needed), and invocation of the `readyCallback`.
 * `upgrade` does nothing if the element is already upgraded, or
 * if it matches no registered custom tag name.
 *
 * @method ugprade
 * @param {Element} inElement The element to upgrade.
 * @return {Element} The upgraded element.
 */
scope.upgrade = upgradeElement;

}

})(window.CustomElements);
