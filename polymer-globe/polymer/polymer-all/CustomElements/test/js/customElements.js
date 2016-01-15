/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

 suite('customElements', function() {
  var work;
  var assert = chai.assert;

  setup(function() {
    work = document.createElement('div');
    document.body.appendChild(work);
  });

  teardown(function() {
    document.body.removeChild(work);
  });

  test('document.register create via new', function() {
    // register x-foo
    var XFoo = document.register('x-foo', {prototype: Object.create(HTMLElement.prototype)});
    // create an instance via new
    var xfoo = new XFoo();
    // test localName
    assert.equal(xfoo.localName, 'x-foo');
    // attach content
    work.appendChild(xfoo).textContent = '[x-foo]';
    // reacquire
    var xfoo = work.querySelector('x-foo');
    // test textContent
    assert.equal(xfoo.textContent, '[x-foo]');
  });

  test('document.register create via createElement', function() {
    // register x-foo
    var XFoo = document.register('x-foo2', {prototype:  Object.create(HTMLElement.prototype)});
    // create an instance via createElement
    var xfoo = document.createElement('x-foo2');
    // test localName
    assert.equal(xfoo.localName, 'x-foo2');
    // attach content
    xfoo.textContent = '[x-foo2]';
    // test textContent
    assert.equal(xfoo.textContent, '[x-foo2]');
  });

  test('document.register create multiple instances', function() {
    var XFooPrototype = Object.create(HTMLElement.prototype);
    XFooPrototype.bluate = function() {
      this.color = 'lightblue';
    };
    var XFoo = document.register('x-foo3', {
      prototype: XFooPrototype
    });
    // create an instance
    var xfoo1 = new XFoo();
    // create another instance
    var xfoo2 = new XFoo();
    // test textContent
    xfoo1.textContent = '[x-foo1]';
    xfoo2.textContent = '[x-foo2]';
    assert.equal(xfoo1.textContent, '[x-foo1]');
    assert.equal(xfoo2.textContent, '[x-foo2]');
    // test bluate
    xfoo1.bluate();
    assert.equal(xfoo1.color, 'lightblue');
    assert.isUndefined(xfoo2.color);
  });

  test('document.register extend native element', function() {
    // test native element extension
    var XBarPrototype = Object.create(HTMLButtonElement.prototype);
    var XBar = document.register('x-bar', {
      prototype: XBarPrototype,
      extends: 'button'
    });
    var xbar = new XBar();
    work.appendChild(xbar).textContent = 'x-bar';
    xbar = work.querySelector('button[is=x-bar]');
    assert(xbar);
    assert.equal(xbar.textContent, 'x-bar');
    // test extension of native element extension
    var XBarBarPrototype = Object.create(XBarPrototype);
    var XBarBar = document.register('x-barbar', {
      prototype: XBarBarPrototype,
      extends: 'x-bar'
    });
    var xbarbar = new XBarBar();
    work.appendChild(xbarbar).textContent = 'x-barbar';
    xbarbar = work.querySelector('button[is=x-barbar]');
    assert(xbarbar);
    assert.equal(xbarbar.textContent, 'x-barbar');
    // test extension^3
    var XBarBarBarPrototype = Object.create(XBarBarPrototype);
    var XBarBarBar = document.register('x-barbarbar', {
      prototype: XBarBarBarPrototype,
      extends: 'x-barbar'
    });
    var xbarbarbar = new XBarBarBar();
    work.appendChild(xbarbarbar).textContent = 'x-barbarbar';
    xbarbarbar = work.querySelector('button[is=x-barbarbar]');
    assert(xbarbarbar);
    assert.equal(xbarbarbar.textContent, 'x-barbarbar');
  });

  test('document.register readyCallback in prototype', function() {
    var XBooPrototype = Object.create(HTMLElement.prototype);
    XBooPrototype.readyCallback = function() {
      this.style.fontStyle = 'italic';
    }
    var XBoo = document.register('x-boo', {
      prototype: XBooPrototype
    });
    var xboo = new XBoo();
    assert.equal(xboo.style.fontStyle, 'italic');
    //
    var XBooBooPrototype = Object.create(XBooPrototype);
    XBooBooPrototype.readyCallback = function() {
      XBoo.prototype.readyCallback.call(this);
      this.style.fontSize = '32pt';
    };
    var XBooBoo = document.register('x-booboo', {
      prototype: XBooBooPrototype,
      extends: 'x-boo'
    });
    var xbooboo = new XBooBoo();
    assert.equal(xbooboo.style.fontStyle, 'italic');
    assert.equal(xbooboo.style.fontSize, '32pt');
  });


  test('document.register [ready|inserted|removed]Callbacks in prototype', function(done) {
    var ready, inserted, removed;
    var XBooPrototype = Object.create(HTMLElement.prototype);
    XBooPrototype.readyCallback = function() {
      ready = true;
    }
    XBooPrototype.insertedCallback = function() {
      inserted = true;
    }
    XBooPrototype.removedCallback = function() {
      removed = true;
    }
    var XBoo = document.register('x-boo-ir', {
      prototype: XBooPrototype
    });
    var xboo = new XBoo();
    assert(ready, 'ready must be true [XBoo]');
    assert(!inserted, 'inserted must be false [XBoo]');
    assert(!removed, 'removed must be false [XBoo]');
    work.appendChild(xboo);
    setTimeout(function() {
      assert(inserted, 'inserted must be true [XBoo]');
      work.removeChild(xboo);
      setTimeout(function() {
        assert(removed, 'removed must be true [XBoo]');
        //
        ready = inserted = removed = false;
        var XBooBooPrototype = Object.create(XBooPrototype);
        XBooBooPrototype.readyCallback = function() {
          XBoo.prototype.readyCallback.call(this);
        };
        XBooBooPrototype.insertedCallback = function() {
          XBoo.prototype.insertedCallback.call(this);
        };
        XBooBooPrototype.removedCallback = function() {
          XBoo.prototype.removedCallback.call(this);
        };
        var XBooBoo = document.register('x-booboo-ir', {
          prototype: XBooBooPrototype,
          extends: 'x-boo-ir'
        });
        var xbooboo = new XBooBoo();
        assert(ready, 'ready must be true [XBooBoo]');
        assert(!inserted, 'inserted must be false [XBooBoo]');
        assert(!removed, 'removed must be false [XBooBoo]');
        work.appendChild(xbooboo);
        setTimeout(function() {
          assert(inserted, 'inserted must be true [XBooBoo]');
          work.removeChild(xbooboo);
          setTimeout(function() {
            assert(removed, 'removed must be true [XBooBoo]');
            done();
          }, 0);
        }, 0);
       }, 0);
     }, 0);
  });

  test('document.register attributeChangedCallback in prototype', function(done) {
    var XBooPrototype = Object.create(HTMLElement.prototype);
    XBooPrototype.attributeChangedCallback = function(inName, inOldValue) {
      if (inName == 'foo' && inOldValue=='bar'
          && this.attributes.foo.value == 'zot') {
        done();
      }
    }
    var XBoo = document.register('x-boo-acp', {
      prototype: XBooPrototype
    });
    var xboo = new XBoo();
    xboo.setAttribute('foo', 'bar');
    xboo.setAttribute('foo', 'zot');
  });

  test('node.cloneNode upgrades', function(done) {
    var XBooPrototype = Object.create(HTMLElement.prototype);
    XBooPrototype.readyCallback = function() {
      this.__ready__ = true;
    };
    var XBoo = document.register('x-boo-clone', {
      prototype: XBooPrototype
    });
    var xboo = new XBoo();
    work.appendChild(xboo);
    setTimeout(function() {
      var xboo2 = xboo.cloneNode(true);
      assert(xboo2.__ready__, 'clone readyCallback must be called');
      done();
    }, 0);
  });
});

htmlSuite('customElements (html)', function() {
  htmlTest('html/attributes.html');
  htmlTest('html/descriptors.html');
});
