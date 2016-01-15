Polymer('x-quux', {
  ready: function() {
    this.style.fontSize = '24px';
    this.__proto__.__proto__.ready.call(this);
  }
});
