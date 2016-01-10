(function(scope) {

  function register(name, extnds, proto, templates) {
    if (window.ShadowDOMPolyfill) {
      shim(templates, name, extnds);
    }
    var ctor = document.register(name, {
      prototype: Object.create(proto, {
        readyCallback: {
          value: function() {
            if (templates) {
              templates.forEach(function(t) {
                var template = document.querySelector('#' + t);
                if (template) {
                  this.createShadowRoot().appendChild(template.createInstance());
                }
              }, this);
            }
          }
        }
      })
    });
    return ctor;
  }
  
  function shim(templates, name, extnds) {
    templates.forEach(function(templateName) {
      var template = document.querySelector('#' + templateName);
      if (template) {
        Platform.ShadowCSS.shimStyling(template.content, name, extnds);
      }
    });
  }
  
  scope.register = register;

})(window);

