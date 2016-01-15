/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

htmlSuite('Document', function() {

  var wrap = ShadowDOMPolyfill.wrap;

  var div;
  teardown(function() {
    if (div) {
      if (div.parentNode)
        div.parentNode.removeChild(div);
      div = undefined;
    }
  });

  test('Ensure Document has ParentNodeInterface', function() {
    var doc = wrap(document).implementation.createHTMLDocument('');
    assert.equal(doc.firstElementChild.tagName, 'HTML');
    assert.equal(doc.lastElementChild.tagName, 'HTML');

    var doc2 = document.implementation.createHTMLDocument('');
    assert.equal(doc2.firstElementChild.tagName, 'HTML');
    assert.equal(doc2.lastElementChild.tagName, 'HTML');
  });

  test('document.documentElement', function() {
    var doc = wrap(document);
    assert.equal(doc.documentElement.ownerDocument, doc);
    assert.equal(doc.documentElement.tagName, 'HTML');
  });

  test('document.body', function() {
    var doc = wrap(document);
    assert.equal(doc.body.ownerDocument, doc);
    assert.equal(doc.body.tagName, 'BODY');
    assert.equal(doc.body.parentNode, doc.documentElement);
  });

  test('document.head', function() {
    var doc = wrap(document);
    assert.equal(doc.head.ownerDocument, doc);
    assert.equal(doc.head.tagName, 'HEAD');
    assert.equal(doc.head.parentNode, doc.documentElement);
  });

  test('getElementsByTagName', function() {
    var elements = document.getElementsByTagName('body');
    assert.isTrue(elements instanceof NodeList);
    assert.equal(elements.length, 1);
    assert.isTrue(elements[0] instanceof HTMLElement);

    var doc = wrap(document);
    assert.equal(doc.body, elements[0]);
    assert.equal(doc.body, elements.item(0));

    var elements2 = doc.getElementsByTagName('body');
    assert.isTrue(elements2 instanceof NodeList);
    assert.equal(elements2.length, 1);
    assert.isTrue(elements2[0] instanceof HTMLElement);
    assert.equal(doc.body, elements2[0]);
    assert.equal(doc.body, elements2.item(0));

    div = document.body.appendChild(document.createElement('div'));
    div.innerHTML = '<aa></aa><aa></aa>';
    var aa1 = div.firstChild;
    var aa2 = div.lastChild;

    var sr = div.createShadowRoot();
    sr.innerHTML = '<aa></aa><aa></aa>';
    var aa3 = sr.firstChild;
    var aa4 = sr.lastChild;

    div.offsetHeight;

    var elements = document.getElementsByTagName('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa1);
    assert.equal(elements[1], aa2);

    var elements = sr.getElementsByTagName('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa3);
    assert.equal(elements[1], aa4);
  });

  test('getElementsByTagNameNS', function() {
    var div = document.createElement('div');
    var nsOne = 'http://one.com';
    var nsTwo = 'http://two.com';
    var aOne = div.appendChild(document.createElementNS(nsOne, 'a'));
    var aTwo = div.appendChild(document.createElementNS(nsTwo, 'a'));

    var all = div.getElementsByTagNameNS(nsOne, 'a');
    assert.equal(all.length, 1);
    assert.equal(all[0], aOne);

    var all = div.getElementsByTagNameNS(nsTwo, 'a');
    assert.equal(all.length, 1);
    assert.equal(all[0], aTwo);

    var all = div.getElementsByTagNameNS('*', 'a');
    assert.equal(all.length, 2);
    assert.equal(all[0], aOne);
    assert.equal(all[1], aTwo);
  });

  test('querySelectorAll', function() {
    var elements = document.querySelectorAll('body');
    assert.isTrue(elements instanceof NodeList);
    assert.equal(elements.length, 1);
    assert.isTrue(elements[0] instanceof HTMLElement);

    var doc = wrap(document);
    assert.equal(doc.body, elements[0]);

    var elements2 = doc.querySelectorAll('body');
    assert.isTrue(elements2 instanceof NodeList);
    assert.equal(elements2.length, 1);
    assert.isTrue(elements2[0] instanceof HTMLElement);
    assert.equal(doc.body, elements2[0]);

    div = document.body.appendChild(document.createElement('div'));
    div.innerHTML = '<aa></aa><aa></aa>';
    var aa1 = div.firstChild;
    var aa2 = div.lastChild;

    var sr = div.createShadowRoot();
    sr.innerHTML = '<aa></aa><aa></aa>';
    var aa3 = sr.firstChild;
    var aa4 = sr.lastChild;

    div.offsetHeight;

    var elements = document.querySelectorAll('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa1);
    assert.equal(elements[1], aa2);

    var elements = sr.querySelectorAll('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa3);
    assert.equal(elements[1], aa4);
  });

  test('addEventListener', function() {
    var calls = 0;
    var doc = wrap(document);
    document.addEventListener('click', function f(e) {
      calls++;
      assert.equal(this, doc);
      assert.equal(e.target, doc.body);
      assert.equal(e.currentTarget, this);
      document.removeEventListener('click', f);
    });
    doc.addEventListener('click', function f(e) {
      calls++;
      assert.equal(this, doc);
      assert.equal(e.target, doc.body);
      assert.equal(e.currentTarget, this);
      doc.removeEventListener('click', f);
    });

    document.body.click();
    assert.equal(2, calls);

    document.body.click();
    assert.equal(2, calls);
  });

  test('adoptNode', function() {
    var doc = wrap(document);
    var doc2 = doc.implementation.createHTMLDocument('');
    var div = doc2.createElement('div');
    assert.equal(div.ownerDocument, doc2);

    var div2 = document.adoptNode(div);
    assert.equal(div, div2);
    assert.equal(div.ownerDocument, doc);

    var div3 = doc2.adoptNode(div);
    assert.equal(div, div3);
    assert.equal(div.ownerDocument, doc2);
  });

  test('adoptNode with shadowRoot', function() {
    var doc = wrap(document);
    var doc2 = doc.implementation.createHTMLDocument('');
    var div = doc2.createElement('div');
    var sr = div.createShadowRoot();
    sr.innerHTML = '<a></a>';
    var a = sr.firstChild;

    var sr2 = div.createShadowRoot();
    sr2.innerHTML = '<b><shadow></shadow></b>';
    var b = sr2.firstChild;

    var sr3 = a.createShadowRoot();
    sr3.innerHTML = '<c></c>';
    var c = sr3.firstChild;

    assert.equal(div.ownerDocument, doc2);
    assert.equal(sr.ownerDocument, doc2);
    assert.equal(sr2.ownerDocument, doc2);
    assert.equal(sr3.ownerDocument, doc2);
    assert.equal(a.ownerDocument, doc2);
    assert.equal(b.ownerDocument, doc2);
    assert.equal(c.ownerDocument, doc2);

    doc.adoptNode(div);

    assert.equal(div.ownerDocument, doc);
    assert.equal(sr.ownerDocument, doc);
    assert.equal(sr2.ownerDocument, doc);
    assert.equal(sr3.ownerDocument, doc);
    assert.equal(a.ownerDocument, doc);
    assert.equal(b.ownerDocument, doc);
    assert.equal(c.ownerDocument, doc);
  });

  test('elementFromPoint', function() {
    div = document.body.appendChild(document.createElement('div'));
    div.style.cssText = 'position: fixed; background: green; ' +
                        'width: 10px; height: 10px; top: 0; left: 0;';

    assert.equal(document.elementFromPoint(5, 5), div);

    var doc = wrap(document);
    assert.equal(doc.elementFromPoint(5, 5), div);
  });

  test('elementFromPoint in shadow', function() {
    div = document.body.appendChild(document.createElement('div'));
    div.style.cssText = 'position: fixed; background: red; ' +
                        'width: 10px; height: 10px; top: 0; left: 0;';
    var sr = div.createShadowRoot();
    sr.innerHTML = '<a></a>';
    var a = sr.firstChild;
    a.style.cssText = 'position: absolute; width: 100%; height: 100%; ' +
                      'background: green';

    assert.equal(document.elementFromPoint(5, 5), div);

    var doc = wrap(document);
    assert.equal(doc.elementFromPoint(5, 5), div);
  });

  htmlTest('html/document-write.html');
});
