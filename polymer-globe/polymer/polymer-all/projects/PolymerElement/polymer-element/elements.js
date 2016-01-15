Polymer('x-foo', {
  ready: function() {
    this.style.color = 'blue';
  }
});

Polymer('x-bar', {
  ready: function() {
    this.style.padding = '4px';
    this.style.backgroundColor = 'orange';
    this.__proto__.__proto__.ready.call(this);
  },
  parseElement: function() {
    this.webkitCreateShadowRoot().appendChild(document.createElement('content'));
    this.textContent = 'Override!';
  }
});
