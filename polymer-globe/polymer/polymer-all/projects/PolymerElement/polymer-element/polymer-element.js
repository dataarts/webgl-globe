(function() {
  document.baseHTMLPrototype = function(tag) {
    var base = tag ? 
        Object.getPrototypeOf(document.createElement(tag)) :
            HTMLElement.prototype;
    return Object.create(base);
  }
  
  var registry = {};
  
  Polymer = function(name, prototype) {
    registry[name] = prototype;
  }
  
  document.register('polymer-element', {
    prototype: Object.create(HTMLElement.prototype, {
      readyCallback: {
        value: function() {
          var name = this.getAttribute('name');
          var extnds = this.getAttribute('extends');
          var prototype = document.baseHTMLPrototype(extnds);
          // insert boilerplate api in inheritance chain (if needed)
          if (!prototype.parseElements) {
            Platform.mixin(prototype, boiler);
            prototype = Object.create(prototype);
          }
          // combine custom api into prototype, and element property
          var api = registry[name];
          if (api) {
            Platform.mixin(prototype, api);
          }
          // questionable backref
          prototype.element = this;
          // register the custom type
          var ctor = document.register(name, {
            prototype: prototype
          });
          // constructor shenanigans
          prototype.constructor = ctor;
          // cache useful stuff
          this.ctor = ctor;
          this.prototype = prototype;
        }          
      }
    })
  });
  
  var boiler = {
    ready: function() {
    },
    readyCallback: function() {
      this.parseElements(this.__proto__);
      this.ready();
    },
    parseElements: function(p) {
      if (p && p.element) {
        this.parseElements(p.__proto__);
        p.parseElement.call(this, p.element);
      }
    },
    parseElement: function(elementElement) {
      var t = elementElement.querySelector('template');
      if (t) {
        this.createShadowRootFromTemplate(t); 
      }
    },
    createShadowRootFromTemplate: function(template) {
      this.webkitCreateShadowRoot().appendChild(template.createInstance());
    }
  };
  
  //CustomElements.upgradeDocument(document);    
})();
