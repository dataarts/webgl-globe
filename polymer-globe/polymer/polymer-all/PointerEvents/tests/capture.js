/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

suite('Pointer Capture', function() {
  var set = function(el) {
    el.setPointerCapture(1);
  };
  var release = function(el) {
    el.releasePointerCapture(1);
  };

  test('Element has setPointerCapture and releasePointerCapture', function() {
    expect(host).to.have.property('setPointerCapture');
    expect(host).to.have.property('releasePointerCapture');
  });

  test('setPointerCapture throw exceptions when the pointerId is not on screen', function() {
    expect(function(){ set(host) }).to.throw(/InvalidPointerId/);
  });

  test('releasePointerCapture throws exception when the pointerId is not on screen', function() {
    expect(function(){ release(host) }).to.throw(/InvalidPointerId/);
  });

  suite('pointercapture events', function() {
    test('Element.setPointerCapture fires a gotpointercapture event', function(done) {
      prep('gotpointercapture', host, done);
      fire('down', host);
      set(host);
      fire('up', host);
    });

    test('Element.releasePointerCapture fires a lostpointercapture event', function(done) {
      prep('lostpointercapture', host, done);
      fire('down', host);
      set(host);
      release(host);
      fire('up', host);
    });

    test('pointerup fires a lostpointercapture event for the element capturing that pointerId', function(done) {
      prep('lostpointercapture', host, done);
      host.addEventListener('lostpointercapture', done);
      fire('down', host);
      set(host);
      fire('up', host);
    });

    test('setPointerCapture will release an already captured pointer, firing events', function(done) {
      var issued = 0;
      var wait = function() {
        issued++;
        return function(e) {
          issued--;
          if (e) {
            throw e;
          }
          if (issued == 0) {
            done();
          }
        }
      };
      prep('gotpointercapture', inner, wait());
      prep('lostpointercapture', host, wait());
      fire('down', host);
      set(host);
      set(inner);
      fire('up', host);
    });
  });
});
