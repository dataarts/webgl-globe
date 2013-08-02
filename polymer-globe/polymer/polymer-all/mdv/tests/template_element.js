// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var testDiv;

function unbindAll(node) {
  node.unbindAll();
  for (var child = node.firstChild; child; child = child.nextSibling)
    unbindAll(child);
}

function doSetup() {
  testDiv = document.body.appendChild(document.createElement('div'));
  Observer._errorThrownDuringCallback = false;
}

function doTeardown() {
  assert.isFalse(!!Observer._errorThrownDuringCallback);
  document.body.removeChild(testDiv);
  unbindAll(testDiv);
  Platform.performMicrotaskCheckpoint();
  assert.strictEqual(2, Observer._allObserversCount);
}

function createTestHtml(s) {
  var div = document.createElement('div');
  div.innerHTML = s;
  testDiv.appendChild(div);

  HTMLTemplateElement.forAllTemplatesFrom_(div, function(template) {
    HTMLTemplateElement.decorate(template);
  });

  return div;
}

function recursivelySetTemplateModel(node, model, delegate) {
  HTMLTemplateElement.forAllTemplatesFrom_(node, function(template) {
    template.bindingDelegate = delegate;
    template.model = model;
  });
}

suite('Template Element', function() {

  setup(doSetup)

  teardown(doTeardown);

  function createShadowTestHtml(s) {
    var div = document.createElement('div');
    var root = div.webkitCreateShadowRoot();
    root.innerHTML = s;
    testDiv.appendChild(div);

    HTMLTemplateElement.forAllTemplatesFrom_(div, function(node) {
      HTMLTemplateElement.decorate(node);
    });

    return root;
  }

  function dispatchEvent(type, target) {
    var event = document.createEvent('Event');
    event.initEvent(type, true, false);
    target.dispatchEvent(event);
  }

  test('Template', function() {
    var div = createTestHtml(
        '<template bind={{}}>text</template>');
    recursivelySetTemplateModel(div);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('text', div.lastChild.textContent);
  });

  test('Template bind, no parent', function() {
    var div = createTestHtml(
      '<template bind>text</template>');
    var template = div.firstChild;
    div.removeChild(template);

    recursivelySetTemplateModel(template, {});
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(0, template.childNodes.length);
    assert.strictEqual(null, template.nextSibling);
    assert.isFalse(!!Observer._errorThrownDuringCallback);
  });

  test('Template bind, no defaultView', function() {
    var div = createTestHtml(
      '<template bind>text</template>');
    var template = div.firstChild;
    var doc = document.implementation.createHTMLDocument('');
    doc.adoptNode(div);
    recursivelySetTemplateModel(template, {});
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);
    assert.isFalse(!!Observer._errorThrownDuringCallback);
  });

  test('Template-Empty Bind', function() {
    var div = createTestHtml(
        '<template bind>text</template>');
    recursivelySetTemplateModel(div);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('text', div.lastChild.textContent);
  });

  test('Template Bind If', function() {
    var div = createTestHtml(
        '<template bind if="{{ foo }}">text</template>');
    var m = { foo: 0 };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    m.foo = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('text', div.lastChild.textContent);
  });

  test('Template Bind If, 2', function() {
    var div = createTestHtml(
        '<template bind="{{ foo }}" if="{{ bar }}">{{ bat }}</template>');
    var m = { bar: 0, foo: { bat: 'baz' } };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    m.bar = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('baz', div.lastChild.textContent);
  });

  test('Template If', function() {
    var div = createTestHtml(
        '<template if="{{ foo }}">{{ value }}</template>');
    var m = { foo: 0, value: 'foo' };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    m.foo = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('foo', div.lastChild.textContent);
  });

  test('Template Repeat If', function() {
    var div = createTestHtml(
        '<template repeat="{{ foo }}" if="{{ bar }}">{{ }}</template>');
    var m = { bar: 0, foo: [1, 2, 3] };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    m.bar = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('1', div.childNodes[1].textContent);
    assert.strictEqual('2', div.childNodes[2].textContent);
    assert.strictEqual('3', div.childNodes[3].textContent);
  });

  test('TextTemplateWithNullStringBinding', function() {
    var div = createTestHtml(
        '<template bind={{}}>a{{b}}c</template>');
    var model =  {b: 'B'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('aBc', div.lastChild.textContent);

    model.b = 'b';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('abc', div.lastChild.textContent);

    model.b = undefined;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('ac', div.lastChild.textContent);

    model = undefined;
    Platform.performMicrotaskCheckpoint();
    // setting model isn't observable.
    assert.strictEqual('ac', div.lastChild.textContent);
  });

  test('TextTemplateWithBindingPath', function() {
    var div = createTestHtml(
        '<template bind="{{ data }}">a{{b}}c</template>');
    var model =  { data: {b: 'B'} };
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('aBc', div.lastChild.textContent);

    model.data.b = 'b';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('abc', div.lastChild.textContent);

    model.data = {b: 'X'};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('aXc', div.lastChild.textContent);

    model.data = undefined;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('ac', div.lastChild.textContent);
  });

  test('TextTemplateWithBindingAndConditional', function() {
    var div = createTestHtml(
        '<template bind="{{}}" if="{{ d }}">a{{b}}c</template>');
    var model =  {b: 'B', d: 1};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('aBc', div.lastChild.textContent);

    model.b = 'b';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('abc', div.lastChild.textContent);

    model.d = '';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    model.d = 'here';
    model.b = 'd';

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('adc', div.lastChild.textContent);
  });

  test('TemplateWithTextBinding2', function() {
    var div = createTestHtml(
        '<template bind="{{ b }}">a{{value}}c</template>');
    assert.strictEqual(1, div.childNodes.length);
    var model = {b: {value: 'B'}};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('aBc', div.lastChild.textContent);

    model.b = {value: 'b'};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('abc', div.lastChild.textContent);
  });

  test('TemplateWithAttributeBinding', function() {
    var div = createTestHtml(
        '<template bind="{{}}">' +
        '<div foo="a{{b}}c"></div>' +
        '</template>');
    var model = {b: 'B'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('aBc', div.lastChild.getAttribute('foo'));

    model.b = 'b';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('abc', div.lastChild.getAttribute('foo'));

    model.b = 'X';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('aXc', div.lastChild.getAttribute('foo'));
  });

  test('TemplateWithConditionalBinding', function() {
    var div = createTestHtml(
        '<template bind="{{}}">' +
        '<div foo?="{{b}}"></div>' +
        '</template>');
    var model = {b: 'b'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.isTrue(div.lastChild.hasAttribute('foo'));
    assert.isFalse(div.lastChild.hasAttribute('foo?'));
    assert.strictEqual('', div.lastChild.getAttribute('foo'));

    model.b = null;
    Platform.performMicrotaskCheckpoint();
    assert.isFalse(div.lastChild.hasAttribute('foo'));
  });

  test('Repeat', function() {
    var div = createTestHtml(
        '<template repeat="{{}}"">text</template>');

    var model = [0, 1, 2];
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);

    model.length = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);

    model.push(3, 4);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);

    model.splice(1, 1);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(3, div.childNodes.length);
  });

  test('Repeat - Reuse Instances', function() {
    function addExpandos(node) {
      while (node) {
        node.expando = Number(node.textContent);
        node = node.nextSibling;
      }
    }

    function checkExpandos(node) {
      assert.isDefined(node);
      while (node) {
        assert.strictEqual(node.expando, Number(node.textContent));
        node = node.nextSibling;
      }
    }

    var div = createTestHtml(
        '<template repeat>{{ val }}</template>');

    var model = [{val: 10},{val: 5},{val: 2},{val: 8},{val: 1}];
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(6, div.childNodes.length);
    var template = div.firstChild;

    addExpandos(template.nextSibling);
    checkExpandos(template.nextSibling);

    // TODO(rafaelw): Re-enable when Object.observe/sort bug is fixed.
    // model.sort(function(a, b) { return a.val - b.val; });
    // Platform.performMicrotaskCheckpoint();
    // checkExpandos(template.nextSibling);

    model = model.slice();
    model.reverse();
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    checkExpandos(template.nextSibling);

    model.forEach(function(item) {
      item.val = item.val + 1;
    });

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('2', div.childNodes[1].textContent);
    assert.strictEqual('9', div.childNodes[2].textContent);
    assert.strictEqual('3', div.childNodes[3].textContent);
    assert.strictEqual('6', div.childNodes[4].textContent);
    assert.strictEqual('11', div.childNodes[5].textContent);
  });

  test('Bind - Reuse Instance', function() {
    function addExpandos(node) {
      while (node) {
        node.expando = Number(node.textContent);
        node = node.nextSibling;
      }
    }

    function checkExpandos(node) {
      assert.isDefined(node);
      while (node) {
        assert.strictEqual(node.expando, Number(node.textContent));
        node = node.nextSibling;
      }
    }

    var div = createTestHtml(
        '<template bind="{{ foo }}">{{ bar }}</template>');

    var model = { foo: { bar: 5 }};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    var template = div.firstChild;

    addExpandos(template.nextSibling);
    checkExpandos(template.nextSibling);

    model = {foo: model.foo};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    checkExpandos(template.nextSibling);
  });

  test('Repeat-Empty', function() {
    var div = createTestHtml(
        '<template repeat>text</template>');

    var model = [0, 1, 2];
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);

    model.length = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);

    model.push(3, 4);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);

    model.splice(1, 1);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(3, div.childNodes.length);
  });

  test('Removal from iteration needs to unbind', function() {
    var div = createTestHtml(
        '<template repeat="{{}}"><a>{{v}}</a></template>');
    var model = [{v: 0}, {v: 1}, {v: 2}, {v: 3}, {v: 4}];
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    var as = [];
    for (var node = div.firstChild.nextSibling; node; node = node.nextSibling) {
      as.push(node);
    }
    var vs = model.slice();  // copy

    for (var i = 0; i < 5; i++) {
      assert.equal(as[i].textContent, String(i));
    }

    model.length = 3;
    Platform.performMicrotaskCheckpoint();
    for (var i = 0; i < 5; i++) {
      assert.equal(as[i].textContent, String(i));
    }

    vs[3].v = 33;
    vs[4].v = 44;
    Platform.performMicrotaskCheckpoint();
    for (var i = 0; i < 5; i++) {
      assert.equal(as[i].textContent, String(i));
    }
  });

  test('DOM Stability on Iteration', function() {
    var div = createTestHtml(
        '<template repeat="{{}}">{{}}</template>');
    var model = [1, 2, 3, 4, 5];
    recursivelySetTemplateModel(div, model);

    function getInstanceNode(index) {
      var node = div.firstChild.nextSibling;
      while (index-- > 0) {
        node = node.nextSibling;
      }
      return node;
    }

    function setInstanceExpando(index, value) {
      getInstanceNode(index)['expando'] = value;
    }

    function getInstanceExpando(index) {
      return getInstanceNode(index)['expando'];
    }

    Platform.performMicrotaskCheckpoint();
    setInstanceExpando(0, 0);
    setInstanceExpando(1, 1);
    setInstanceExpando(2, 2);
    setInstanceExpando(3, 3);
    setInstanceExpando(4, 4);

    model.shift();
    model.pop();

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, getInstanceExpando(0));
    assert.strictEqual(2, getInstanceExpando(1));
    assert.strictEqual(3, getInstanceExpando(2));

    model.unshift(5);
    model[2] = 6;
    model.push(7);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(undefined, getInstanceExpando(0));
    assert.strictEqual(1, getInstanceExpando(1));
    assert.strictEqual(undefined, getInstanceExpando(2));
    assert.strictEqual(3, getInstanceExpando(3));
    assert.strictEqual(undefined, getInstanceExpando(4));

    setInstanceExpando(0, 5);
    setInstanceExpando(2, 6);
    setInstanceExpando(4, 7);

    model.splice(2, 0, 8);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(5, getInstanceExpando(0));
    assert.strictEqual(1, getInstanceExpando(1));
    assert.strictEqual(undefined, getInstanceExpando(2));
    assert.strictEqual(6, getInstanceExpando(3));
    assert.strictEqual(3, getInstanceExpando(4));
    assert.strictEqual(7, getInstanceExpando(5));
  });

  test('Repeat2', function() {
    var div = createTestHtml(
        '<template repeat="{{}}">{{value}}</template>');
    assert.strictEqual(1, div.childNodes.length);

    var model = [
      {value: 0},
      {value: 1},
      {value: 2}
    ];
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('0', div.childNodes[1].textContent);
    assert.strictEqual('1', div.childNodes[2].textContent);
    assert.strictEqual('2', div.childNodes[3].textContent);

    model[1].value = 'One';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('0', div.childNodes[1].textContent);
    assert.strictEqual('One', div.childNodes[2].textContent);
    assert.strictEqual('2', div.childNodes[3].textContent);

    model.splice(0, 1, {value: 'Zero'});
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('Zero', div.childNodes[1].textContent);
    assert.strictEqual('One', div.childNodes[2].textContent);
    assert.strictEqual('2', div.childNodes[3].textContent);
  });

  test('TemplateWithInputValue', function() {
    var div = createTestHtml(
        '<template bind="{{}}">' +
        '<input value="{{x}}">' +
        '</template>');
    var model = {x: 'hi'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('hi', div.lastChild.value);

    model.x = 'bye';
    assert.strictEqual('hi', div.lastChild.value);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('bye', div.lastChild.value);

    div.lastChild.value = 'hello';
    dispatchEvent('input', div.lastChild);
    assert.strictEqual('hello', model.x);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('hello', div.lastChild.value);
  });

//////////////////////////////////////////////////////////////////////////////

  test('Decorated', function() {
    var div = createTestHtml(
        '<template bind="{{ XX }}" id="t1">' +
          '<p>Crew member: {{name}}, Job title: {{title}}</p>' +
        '</template>' +
        '<template bind="{{ XY }}" id="t2" ref="t1"></template>');

    var model = {
      XX: {name: 'Leela', title: 'Captain'},
      XY: {name: 'Fry', title: 'Delivery boy'},
      XZ: {name: 'Zoidberg', title: 'Doctor'}
    };
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();

    var t1 = document.getElementById('t1');
    var instance = t1.nextElementSibling;
    assert.strictEqual('Crew member: Leela, Job title: Captain', instance.textContent);

    var t2 = document.getElementById('t2');
    instance = t2.nextElementSibling;
    assert.strictEqual('Crew member: Fry, Job title: Delivery boy',
                 instance.textContent);

    assert.strictEqual(4, div.children.length);
    assert.strictEqual(4, div.childNodes.length);

    assert.strictEqual('P', div.childNodes[1].tagName);
    assert.strictEqual('P', div.childNodes[3].tagName);
  });

  test('DefaultStyles', function() {
    var t = document.createElement('template');
    HTMLTemplateElement.decorate(t);

    document.body.appendChild(t);
    assert.strictEqual('none', getComputedStyle(t, null).display);

    document.body.removeChild(t);
  });


  test('Bind', function() {
    var div = createTestHtml('<template bind="{{}}">Hi {{ name }}</template>');
    var model = {name: 'Leela'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('Hi Leela', div.childNodes[1].textContent);
  });

  test('BindImperative', function() {
    var div = createTestHtml(
        '<template>' +
          'Hi {{ name }}' +
        '</template>');
    var t = div.firstChild;

    var model = {name: 'Leela'};
    t.bind('bind', model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('Hi Leela', div.childNodes[1].textContent);
  });

  test('BindPlaceHolderHasNewLine', function() {
    var div = createTestHtml('<template bind="{{}}">Hi {{\nname\n}}</template>');
    var model = {name: 'Leela'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('Hi Leela', div.childNodes[1].textContent);
  });

  test('BindWithRef', function() {
    var id = 't' + Math.random();
    var div = createTestHtml(
        '<template id="' + id +'">' +
          'Hi {{ name }}' +
        '</template>' +
        '<template ref="' + id + '" bind="{{}}"></template>');

    var t1 = div.firstChild;
    var t2 = div.childNodes[1];

    assert.strictEqual(t1, t2.ref);

    var model = {name: 'Fry'};
    recursivelySetTemplateModel(div, model);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('Hi Fry', t2.nextSibling.textContent);
  });

  test('BindChanged', function() {
    var model = {
      XX: {name: 'Leela', title: 'Captain'},
      XY: {name: 'Fry', title: 'Delivery boy'},
      XZ: {name: 'Zoidberg', title: 'Doctor'}
    };

    var div = createTestHtml(
        '<template bind="{{ XX }}">Hi {{ name }}</template>');

    recursivelySetTemplateModel(div, model);

    var t = div.firstChild;
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('Hi Leela', t.nextSibling.textContent);

    t.bind('bind', model, 'XZ');
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('Hi Zoidberg', t.nextSibling.textContent);
  });

  function assertNodesAre() {
    var expectedLength = arguments.length;
    assert.strictEqual(expectedLength + 1, div.childNodes.length);

    for (var i = 0; i < arguments.length; i++) {
      var targetNode = div.childNodes[i + 1];
      assert.strictEqual(arguments[i], targetNode.textContent);
    }
  }

  test('Repeat3', function() {
    div = createTestHtml('<template repeat="{{ contacts }}">Hi {{ name }}</template>');
    t = div.firstChild;

    var m = {
      contacts: [
        {name: 'Raf'},
        {name: 'Arv'},
        {name: 'Neal'}
      ]
    };

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assertNodesAre('Hi Raf', 'Hi Arv', 'Hi Neal');

    m.contacts.push({name: 'Alex'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Raf', 'Hi Arv', 'Hi Neal', 'Hi Alex');

    m.contacts.splice(0, 2, {name: 'Rafael'}, {name: 'Erik'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Rafael', 'Hi Erik', 'Hi Neal', 'Hi Alex');

    m.contacts.splice(1, 2);
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Rafael', 'Hi Alex');

    m.contacts.splice(1, 0, {name: 'Erik'}, {name: 'Dimitri'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Rafael', 'Hi Erik', 'Hi Dimitri', 'Hi Alex');

    m.contacts.splice(0, 1, {name: 'Tab'}, {name: 'Neal'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Tab', 'Hi Neal', 'Hi Erik', 'Hi Dimitri', 'Hi Alex');

    m.contacts = [{name: 'Alex'}];
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Alex');

    m.contacts.length = 0;
    Platform.performMicrotaskCheckpoint();
    assertNodesAre();
  });

  test('RepeatModelSet', function() {
    div = createTestHtml(
        '<template repeat="{{ contacts }}">' +
          'Hi {{ name }}' +
        '</template>');
    var m = {
      contacts: [
        {name: 'Raf'},
        {name: 'Arv'},
        {name: 'Neal'}
      ]
    };
    recursivelySetTemplateModel(div, m);

    Platform.performMicrotaskCheckpoint();
    t = div.firstChild;

    assertNodesAre('Hi Raf', 'Hi Arv', 'Hi Neal');
  });

  test('RepeatEmptyPath', function() {
    div = createTestHtml('<template repeat="{{}}">Hi {{ name }}</template>');
    t = div.firstChild;

    var m = [
      {name: 'Raf'},
      {name: 'Arv'},
      {name: 'Neal'}
    ];
    recursivelySetTemplateModel(div, m);

    Platform.performMicrotaskCheckpoint();

    assertNodesAre('Hi Raf', 'Hi Arv', 'Hi Neal');

    m.push({name: 'Alex'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Raf', 'Hi Arv', 'Hi Neal', 'Hi Alex');

    m.splice(0, 2, {name: 'Rafael'}, {name: 'Erik'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Rafael', 'Hi Erik', 'Hi Neal', 'Hi Alex');

    m.splice(1, 2);
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Rafael', 'Hi Alex');

    m.splice(1, 0, {name: 'Erik'}, {name: 'Dimitri'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Rafael', 'Hi Erik', 'Hi Dimitri', 'Hi Alex');

    m.splice(0, 1, {name: 'Tab'}, {name: 'Neal'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Tab', 'Hi Neal', 'Hi Erik', 'Hi Dimitri', 'Hi Alex');

    m.length = 0;
    m.push({name: 'Alex'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Alex');
  });

  test('RepeatNullModel', function() {
    div = createTestHtml('<template repeat="{{}}">Hi {{ name }}</template>');
    t = div.firstChild;

    var m = null;
    recursivelySetTemplateModel(div, m);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    t.iterate = '';
    m = {};
    recursivelySetTemplateModel(div, m);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);
  });

  test('RepeatReuse', function() {
    div = createTestHtml('<template repeat="{{}}">Hi {{ name }}</template>');
    t = div.firstChild;

    var m = [
      {name: 'Raf'},
      {name: 'Arv'},
      {name: 'Neal'}
    ];
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assertNodesAre('Hi Raf', 'Hi Arv', 'Hi Neal');
    var node1 = div.childNodes[1];
    var node2 = div.childNodes[2];
    var node3 = div.childNodes[3];

    m.splice(1, 1, {name: 'Erik'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Raf', 'Hi Erik', 'Hi Neal');
    assert.strictEqual(node1, div.childNodes[1],
        'model[0] did not change so the node should not have changed');
    assert.notStrictEqual(node2, div.childNodes[2],
        'Should not reuse when replacing');
    assert.strictEqual(node3, div.childNodes[3],
        'model[2] did not change so the node should not have changed');

    node2 = div.childNodes[2];
    m.splice(0, 0, {name: 'Alex'});
    Platform.performMicrotaskCheckpoint();
    assertNodesAre('Hi Alex', 'Hi Raf', 'Hi Erik', 'Hi Neal');
  });

  test('TwoLevelsDeepBug', function() {
    div = createTestHtml(
      '<template bind="{{}}"><span><span>{{ foo }}</span></span></template>');

    var model = {foo: 'bar'};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('bar',
                 div.childNodes[1].childNodes[0].childNodes[0].textContent);
  });

  test('Checked', function() {
    var div = createTestHtml(
        '<template>' +
          '<input type="checkbox" checked="{{a}}">' +
        '</template>');
    var t = div.firstChild;
    var m = {
      a: true
    };
    t.bind('bind', m);
    Platform.performMicrotaskCheckpoint();

    var instanceInput = t.nextSibling;
    assert.isTrue(instanceInput.checked);

    instanceInput.click();
    assert.isFalse(instanceInput.checked);

    instanceInput.click();
    assert.isTrue(instanceInput.checked);
  });

  function nestedHelper(s, start) {
    var div = createTestHtml(s);

    var m = {
      a: {
        b: 1,
        c: {d: 2}
      },
    };

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var i = start;
    assert.strictEqual('1', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('2', div.childNodes[i++].textContent);

    m.a.b = 11;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('11', div.childNodes[start].textContent);

    m.a.c = {d: 22};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('22', div.childNodes[start + 2].textContent);
  }

  test('Nested', function() {
    nestedHelper(
        '<template bind="{{a}}">' +
          '{{b}}' +
          '<template bind="{{c}}">' +
            '{{d}}' +
          '</template>' +
        '</template>', 1);
  });

  test('NestedWithRef', function() {
    nestedHelper(
        '<template id="inner">{{d}}</template>' +
        '<template id="outer" bind="{{a}}">' +
          '{{b}}' +
          '<template ref="inner" bind="{{c}}"></template>' +
        '</template>', 2);
  });

  function nestedIterateInstantiateHelper(s, start) {
    var div = createTestHtml(s);

    var m = {
      a: [
        {
          b: 1,
          c: {d: 11}
        },
        {
          b: 2,
          c: {d: 22}
        }
      ]
    };

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var i = start;
    assert.strictEqual('1', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('11', div.childNodes[i++].textContent);
    assert.strictEqual('2', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('22', div.childNodes[i++].textContent);

    m.a[1] = {
      b: 3,
      c: {d: 33}
    };

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('3', div.childNodes[start + 3].textContent);
    assert.strictEqual('33', div.childNodes[start + 5].textContent);
  }

  test('NestedRepeatBind', function() {
    nestedIterateInstantiateHelper(
        '<template repeat="{{a}}">' +
          '{{b}}' +
          '<template bind="{{c}}">' +
            '{{d}}' +
          '</template>' +
        '</template>', 1);
  });

  test('NestedRepeatBindWithRef', function() {
    nestedIterateInstantiateHelper(
        '<template id="inner">' +
          '{{d}}' +
        '</template>' +
        '<template repeat="{{a}}">' +
          '{{b}}' +
          '<template ref="inner" bind="{{c}}"></template>' +
        '</template>', 2);
  });

  function nestedIterateIterateHelper(s, start) {
    var div = createTestHtml(s);

    var m = {
      a: [
        {
          b: 1,
          c: [{d: 11}, {d: 12}]
        },
        {
          b: 2,
          c: [{d: 21}, {d: 22}]
        }
      ]
    };

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var i = start;
    assert.strictEqual('1', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('11', div.childNodes[i++].textContent);
    assert.strictEqual('12', div.childNodes[i++].textContent);
    assert.strictEqual('2', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('21', div.childNodes[i++].textContent);
    assert.strictEqual('22', div.childNodes[i++].textContent);

    m.a[1] = {
      b: 3,
      c: [{d: 31}, {d: 32}, {d: 33}]
    };

    i = start + 4;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('3', div.childNodes[start + 4].textContent);
    assert.strictEqual('31', div.childNodes[start + 6].textContent);
    assert.strictEqual('32', div.childNodes[start + 7].textContent);
    assert.strictEqual('33', div.childNodes[start + 8].textContent);
  }

  test('NestedRepeatBind', function() {
    nestedIterateIterateHelper(
        '<template repeat="{{a}}">' +
          '{{b}}' +
          '<template repeat="{{c}}">' +
            '{{d}}' +
          '</template>' +
        '</template>', 1);
  });

  test('NestedRepeatRepeatWithRef', function() {
    nestedIterateIterateHelper(
        '<template id="inner">' +
          '{{d}}' +
        '</template>' +
        '<template repeat="{{a}}">' +
          '{{b}}' +
          '<template ref="inner" repeat="{{c}}"></template>' +
        '</template>', 2);
  });

  test('NestedRepeatSelfRef', function() {
    var div = createTestHtml(
        '<template id="t" repeat="{{}}">' +
          '{{name}}' +
          '<template ref="t" repeat="{{items}}"></template>' +
        '</template>');

    var m = [
      {
        name: 'Item 1',
        items: [
          {
            name: 'Item 1.1',
            items: [
              {
                 name: 'Item 1.1.1',
                 items: []
              }
            ]
          },
          {
            name: 'Item 1.2'
          }
        ]
      },
      {
        name: 'Item 2',
        items: []
      },
    ];

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var i = 1;
    assert.strictEqual('Item 1', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('Item 1.1', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('Item 1.1.1', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('Item 1.2', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('Item 2', div.childNodes[i++].textContent);

    m[0] = {
      name: 'Item 1 changed'
    };

    i = 1;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('Item 1 changed', div.childNodes[i++].textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[i++].tagName);
    assert.strictEqual('Item 2', div.childNodes[i++].textContent);
  });

  test('Attribute Template Optgroup/Option', function() {
    var div = createTestHtml(
        '<template bind>' +
          '<select selectedIndex="{{ selected }}">' +
            '<optgroup template repeat="{{ groups }}" label="{{ name }}">' +
              '<option template repeat="{{ items }}">{{ val }}</option>' +
            '</optgroup>' +
          '</select>' +
        '</template>');

    var m = {
      selected: 1,
      groups: [
        {
          name: 'one', items: [{ val: 0 }, { val: 1 }]
        }
      ],
    };

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var select = div.firstChild.nextSibling;
    assert.strictEqual(2, select.childNodes.length);
    assert.strictEqual(1, select.selectedIndex);
    assert.strictEqual('TEMPLATE', select.childNodes[0].tagName);
    assert.strictEqual('OPTGROUP', select.childNodes[0].ref.content.firstChild.tagName);
    var optgroup = select.childNodes[1];
    assert.strictEqual('TEMPLATE', optgroup.childNodes[0].tagName);
    assert.strictEqual('OPTION', optgroup.childNodes[1].tagName);
    assert.strictEqual('0', optgroup.childNodes[1].textContent);
    assert.strictEqual('OPTION', optgroup.childNodes[2].tagName);
    assert.strictEqual('1', optgroup.childNodes[2].textContent);
  });

  test('NestedIterateTableMixedSemanticNative', function() {
    if (!parserHasNativeTemplate)
      return;

    var div = createTestHtml(
        '<table><tbody>' +
          '<template repeat="{{}}">' +
            '<tr>' +
              '<td template repeat="{{}}" class="{{ val }}">{{ val }}</td>' +
            '</tr>' +
          '</template>' +
        '</tbody></table>');

    var m = [
      [{ val: 0 }, { val: 1 }],
      [{ val: 2 }, { val: 3 }]
    ];

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var i = 1;
    var tbody = div.childNodes[0].childNodes[0];

    // 1 for the <tr template>, 2 * (1 tr)
    assert.strictEqual(3, tbody.childNodes.length);

    // 1 for the <td template>, 2 * (1 td)
    assert.strictEqual(3, tbody.childNodes[1].childNodes.length);
    assert.strictEqual('0', tbody.childNodes[1].childNodes[1].textContent)
    assert.strictEqual('1', tbody.childNodes[1].childNodes[2].textContent)

    // 1 for the <td template>, 2 * (1 td)
    assert.strictEqual(3, tbody.childNodes[2].childNodes.length);
    assert.strictEqual('2', tbody.childNodes[2].childNodes[1].textContent)
    assert.strictEqual('3', tbody.childNodes[2].childNodes[2].textContent)

    // Asset the 'class' binding is retained on the semantic template (just check
    // the last one).
    assert.strictEqual('3', tbody.childNodes[2].childNodes[2].getAttribute('class'));
  });

  test('NestedIterateTable', function() {
    var div = createTestHtml(
        '<table><tbody>' +
          '<tr template repeat="{{}}">' +
            '<td template repeat="{{}}" class="{{ val }}">{{ val }}</td>' +
          '</tr>' +
        '</tbody></table>');

    var m = [
      [{ val: 0 }, { val: 1 }],
      [{ val: 2 }, { val: 3 }]
    ];

    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var i = 1;
    var tbody = div.childNodes[0].childNodes[0];

    // 1 for the <tr template>, 2 * (1 tr)
    assert.strictEqual(3, tbody.childNodes.length);

    // 1 for the <td template>, 2 * (1 td)
    assert.strictEqual(3, tbody.childNodes[1].childNodes.length);
    assert.strictEqual('0', tbody.childNodes[1].childNodes[1].textContent)
    assert.strictEqual('1', tbody.childNodes[1].childNodes[2].textContent)

    // 1 for the <td template>, 2 * (1 td)
    assert.strictEqual(3, tbody.childNodes[2].childNodes.length);
    assert.strictEqual('2', tbody.childNodes[2].childNodes[1].textContent)
    assert.strictEqual('3', tbody.childNodes[2].childNodes[2].textContent)

    // Asset the 'class' binding is retained on the semantic template (just check
    // the last one).
    assert.strictEqual('3', tbody.childNodes[2].childNodes[2].getAttribute('class'));
  });

  test('NestedRepeatDeletionOfMultipleSubTemplates', function() {
    var div = createTestHtml(
        '<ul>' +
          '<template repeat="{{}}" id=t1>' +
            '<li>{{name}}' +
              '<ul>' +
                '<template ref=t1 repaet="{{items}}"></template>' +
              '</ul>' +
            '</li>' +
          '</template>' +
        '</ul>');

    var m = [
      {
        name: 'Item 1',
        items: [
          {
            name: 'Item 1.1'
          }
        ]
      }
    ];

    recursivelySetTemplateModel(div, m);

    Platform.performMicrotaskCheckpoint();
    m.splice(0, 1);
    Platform.performMicrotaskCheckpoint();
  });

  test('DeepNested', function() {
    var div = createTestHtml(
      '<template bind="{{a}}">' +
        '<p>' +
          '<template bind="{{b}}">' +
            '{{ c }}' +
          '</template>' +
        '</p>' +
      '</template>');

    var m = {
      a: {
        b: {
          c: 42
        }
      }
    };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('P', div.childNodes[1].tagName);
    assert.strictEqual('TEMPLATE', div.childNodes[1].firstChild.tagName);
    assert.strictEqual('42', div.childNodes[1].childNodes[1].textContent);
  });

  test('TemplateContentRemoved', function() {
    var div = createTestHtml('<template bind="{{}}">{{ }}</template>');
    var model = 42;

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('42', div.childNodes[1].textContent);
    assert.strictEqual('', div.childNodes[0].textContent);
  });

  test('TemplateContentRemovedEmptyArray', function() {
    var div = createTestHtml('<template iterate>Remove me</template>');
    var model = [];

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);
    assert.strictEqual('', div.childNodes[0].textContent);
  });

  test('TemplateContentRemovedNested', function() {
    var div = createTestHtml(
        '<template bind="{{}}">' +
          '{{ a }}' +
          '<template bind="{{}}">' +
            '{{ b }}' +
          '</template>' +
        '</template>');

    var model = {
      a: 1,
      b: 2
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('', div.childNodes[0].textContent);
    assert.strictEqual('1', div.childNodes[1].textContent);
    assert.strictEqual('', div.childNodes[2].textContent);
    assert.strictEqual('2', div.childNodes[3].textContent);
  });

  test('BindWithUndefinedModel', function() {
    var div = createTestHtml('<template bind="{{}}" if="{{}}">{{ a }}</template>');

    var model = {a: 42};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('42', div.childNodes[1].textContent);

    model = undefined;
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, div.childNodes.length);

    model = {a: 42};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('42', div.childNodes[1].textContent);
  });

  test('BindNested', function() {
    var div = createTestHtml(
        '<template bind="{{}}">' +
          'Name: {{ name }}' +
          '<template bind="{{wife}}" if="{{wife}}">' +
            'Wife: {{ name }}' +
          '</template>' +
          '<template bind="{{child}}" if="{{child}}">' +
            'Child: {{ name }}' +
          '</template>' +
        '</template>');

    var m = {
      name: 'Hermes',
      wife: {
        name: 'LaBarbara'
      }
    };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(5, div.childNodes.length);
    assert.strictEqual('Name: Hermes', div.childNodes[1].textContent);
    assert.strictEqual('Wife: LaBarbara', div.childNodes[3].textContent);

    m.child = {name: 'Dwight'};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(6, div.childNodes.length);
    assert.strictEqual('Child: Dwight', div.childNodes[5].textContent);

    delete m.wife;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(5, div.childNodes.length);
    assert.strictEqual('Child: Dwight', div.childNodes[4].textContent);
  });

  test('BindRecursive', function() {
    var div = createTestHtml(
        '<template bind="{{}}" if="{{}}" id="t">' +
          'Name: {{ name }}' +
          '<template bind="{{friend}}" if="{{friend}}" ref="t"></template>' +
        '</template>');

    var m = {
      name: 'Fry',
      friend: {
        name: 'Bender'
      }
    };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(5, div.childNodes.length);
    assert.strictEqual('Name: Fry', div.childNodes[1].textContent);
    assert.strictEqual('Name: Bender', div.childNodes[3].textContent);

    m.friend.friend = {name: 'Leela'};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(7, div.childNodes.length);
    assert.strictEqual('Name: Leela', div.childNodes[5].textContent);

    m.friend = {name: 'Leela'};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(5, div.childNodes.length);
    assert.strictEqual('Name: Leela', div.childNodes[3].textContent);
  });

  test('RecursiveRef', function() {
    var div = createTestHtml(
        '<template bind>' +
          '<template id=src>{{ foo }}</template>' +
          '<template bind ref=src></template>' +
        '</template>');

    var m = {
      foo: 'bar'
    };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('bar', div.childNodes[3].textContent);
  });

  test('Template - Self is terminator', function() {
    var div = createTestHtml(
        '<template repeat>{{ foo }}' +
          '<template bind></template>' +
        '</template>');

    var m = [{ foo: 'bar' }];
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    m.push({ foo: 'baz' });
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(5, div.childNodes.length);
    assert.strictEqual('bar', div.childNodes[1].textContent);
    assert.strictEqual('baz', div.childNodes[3].textContent);
  });

  test('Template - Same Contents, Different Array has no effect', function() {
    if (!window.MutationObserver)
      return;
    var div = createTestHtml(
        '<template repeat>{{ foo }}</template>');

    var m = [{ foo: 'bar' }, { foo: 'bat'}];
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    var observer = new MutationObserver(function() {});
    observer.observe(div, { childList: true });

    var template = div.firstChild;
    template.bind('repeat', m.slice(), '');
    Platform.performMicrotaskCheckpoint();
    var records = observer.takeRecords();
    assert.strictEqual(0, records.length);
  });


  test('ChangeFromBindToRepeat', function() {
    var div = createTestHtml(
        '<template bind="{{a}}">' +
          '{{ length }}' +
        '</template>');
    var template = div.firstChild;

    var m = {
      a: [
        {length: 0},
        {
          length: 1,
          b: {length: 4}
        },
        {length: 2}
      ]
    };
    recursivelySetTemplateModel(div, m);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('3', div.childNodes[1].textContent);

    template.unbind('bind');
    template.bind('repeat', m, 'a');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('0', div.childNodes[1].textContent);
    assert.strictEqual('1', div.childNodes[2].textContent);
    assert.strictEqual('2', div.childNodes[3].textContent);

    template.unbind('repeat');
    template.bind('bind', m, 'a.1.b')

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('4', div.childNodes[1].textContent);
  });

  test('ChangeRefId', function() {
    var div = createTestHtml(
        '<template id="a">a:{{ }}</template>' +
        '<template id="b">b:{{ }}</template>' +
        '<template repeat="{{}}">' +
          '<template ref="a" bind="{{}}"></template>' +
        '</template>');
    var model = [];
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(3, div.childNodes.length);

    document.getElementById('a').id = 'old-a';
    document.getElementById('b').id = 'a';

    model.push(1, 2);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual(7, div.childNodes.length);
    assert.strictEqual('b:1', div.childNodes[4].textContent);
    assert.strictEqual('b:2', div.childNodes[6].textContent);
  });

  test('Content', function() {
    var div = createTestHtml(
        '<template><a></a></template>' +
        '<template><b></b></template>');
    var templateA = div.firstChild;
    var templateB = div.lastChild;
    var contentA = templateA.content;
    var contentB = templateB.content;
    assert.notStrictEqual(contentA, undefined);

    assert.notStrictEqual(templateA.ownerDocument, contentA.ownerDocument);
    assert.notStrictEqual(templateB.ownerDocument, contentB.ownerDocument);

    assert.strictEqual(templateA.ownerDocument, templateB.ownerDocument);
    assert.strictEqual(contentA.ownerDocument, contentB.ownerDocument);

    assert.strictEqual(templateA.ownerDocument.defaultView, window);
    assert.strictEqual(templateB.ownerDocument.defaultView, window);

    assert.strictEqual(contentA.ownerDocument.defaultView, null);
    assert.strictEqual(contentB.ownerDocument.defaultView, null);

    assert.strictEqual(contentA.firstChild, contentA.lastChild);
    assert.strictEqual(contentA.firstChild.tagName, 'A');

    assert.strictEqual(contentB.firstChild, contentB.lastChild);
    assert.strictEqual(contentB.firstChild.tagName, 'B');
  });

  test('NestedContent', function() {
    var div = createTestHtml(
        '<template>' +
        '<template></template>' +
        '</template>');
    var templateA = div.firstChild;
    var templateB = templateA.content.firstChild;

    assert.strictEqual(templateA.content.ownerDocument, templateB.ownerDocument);
    assert.strictEqual(templateA.content.ownerDocument,
                 templateB.content.ownerDocument);
  });

  test('BindShadowDOM', function() {
    if (HTMLElement.prototype.webkitCreateShadowRoot) {
      var root = createShadowTestHtml(
          '<template bind="{{}}">Hi {{ name }}</template>');
      var model = {name: 'Leela'};
      recursivelySetTemplateModel(root, model);
      Platform.performMicrotaskCheckpoint();
      assert.strictEqual('Hi Leela', root.childNodes[1].textContent);
      unbindAll(root);
    }
  });

  test('BindShadowDOM Template Ref', function() {
    if (HTMLElement.prototype.webkitCreateShadowRoot) {
      var root = createShadowTestHtml(
          '<template id=foo>Hi</template><template bind ref=foo></template>');
      recursivelySetTemplateModel(root, {});
      Platform.performMicrotaskCheckpoint();
      assert.strictEqual(3, root.childNodes.length);
      unbindAll(root);
    }
  });

  // https://github.com/Polymer/mdv/issues/8
  test('UnbindingInNestedBind', function() {
    var div = createTestHtml(
      '<template bind="{{outer}}" if="{{outer}}">' +
        '<template bind="{{inner}}" if="{{inner}}">' +
          '{{ age }}' +
        '</template>' +
      '</template>');

    var count = 0;
    var expectedAge = 42;
    var delegate = {
      getBinding: function(model, path, name, node) {
        if (name != 'textContent' || path != 'age')
          return;

        assert.strictEqual(expectedAge, model.age);
        count++;
      }
    };

    var model = {
      outer: {
        inner: {
          age: 42
        }
      }
    };

    recursivelySetTemplateModel(div, model, delegate);

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, count);

    var inner = model.outer.inner;
    model.outer = null;

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(1, count);

    model.outer = {inner: {age: 2}};
    expectedAge = 2;

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, count);

    testHelper = undefined;
  });

  // https://github.com/Polymer/mdv/issues/8
  test('DontCreateInstancesForAbandonedIterators', function() {
    var div = createTestHtml(
      '<template bind="{{}} {{}}">' +
        '<template bind="{{}}">Foo' +
        '</template>' +
      '</template>');
    recursivelySetTemplateModel(div);
    Platform.performMicrotaskCheckpoint();
    assert.isFalse(!!Observer._errorThrownDuringCallback);
  });

  test('CreateInstance', function() {
    var delegate = {
      getBinding: function(model, path, name, node) {
        if (path.trim() == 'replaceme')
          return { value: 'replaced' };
      }
    };

    var div = createTestHtml(
      '<template bind="{{a}}">' +
        '<template bind="{{b}}">' +
          '{{ foo }}:{{ replaceme }}' +
        '</template>' +
      '</template>');
    var outer = div.firstChild;
    var model = {
      b: {
        foo: 'bar'
      }
    };

    var host = testDiv.appendChild(document.createElement('div'));
    var instance = outer.createInstance(model, delegate);
    assert.strictEqual(instance.firstChild.ref, outer.content.firstChild);

    host.appendChild(instance);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('bar:replaced', host.firstChild.nextSibling.textContent);
  });

  test('Bootstrap', function() {
    var div = document.createElement('div');
    div.innerHTML =
      '<template>' +
        '<div></div>' +
        '<template>' +
          'Hello' +
        '</template>' +
      '</template>';

    HTMLTemplateElement.bootstrap(div);
    var template = div.firstChild;
    assert.strictEqual(2, template.content.childNodes.length);
    var template2 = template.content.firstChild.nextSibling;
    assert.strictEqual(1, template2.content.childNodes.length);
    assert.strictEqual('Hello', template2.content.firstChild.textContent);

    var template = document.createElement('template');
    template.innerHTML =
      '<template>' +
        '<div></div>' +
        '<template>' +
          'Hello' +
        '</template>' +
      '</template>';

    HTMLTemplateElement.bootstrap(template);
    var template2 = template.content.firstChild;
    assert.strictEqual(2, template2.content.childNodes.length);
    var template3 = template2.content.firstChild.nextSibling;
    assert.strictEqual(1, template3.content.childNodes.length);
    assert.strictEqual('Hello', template3.content.firstChild.textContent);
  });
});


suite('Template Syntax', function() {

  setup(doSetup)

  teardown(doTeardown);

  test('Registration', function() {
    var model = { foo: 'bar'};
    var testData = [
      {
        model: model,
        path: '',
        name: 'bind',
        nodeType: Node.ELEMENT_NODE,
        tagName: 'TEMPLATE'
      },
      {
        model: model,
        path: 'foo',
        name: 'textContent',
        nodeType: Node.TEXT_NODE,
        tagName: undefined
      },
      {
        model: model,
        path: '',
        name: 'bind',
        nodeType: Node.ELEMENT_NODE,
        tagName: 'TEMPLATE'
      },
      {
        model: model,
        path: 'foo',
        name: 'textContent',
        nodeType: Node.TEXT_NODE,
        tagName: undefined
      },
    ];

    var delegate = {
      getBinding: function(model, path, name, node) {
        var data = testData.shift();

        assert.strictEqual(data.model, model);
        assert.strictEqual(data.path, path);
        assert.strictEqual(data.name, name);
        assert.strictEqual(data.nodeType, node.nodeType);
        assert.strictEqual(data.tagName, node.tagName);
      }
    };

    var div = createTestHtml(
        '<template bind>{{ foo }}' +
          '<template bind>{{ foo }}</template>' +
        '</template>');
    recursivelySetTemplateModel(div, model, delegate);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('bar', div.lastChild.textContent);
    assert.strictEqual('TEMPLATE', div.childNodes[2].tagName);

    assert.strictEqual(0, testData.length);
  });

  test('getInstanceModel', function() {
    var model = [{ foo: 1 }, { foo: 2 }, { foo: 3 }];

    var div = createTestHtml(
        '<template repeat syntax="Test">' +
        '{{ foo }}</template>');
    var template = div.firstChild;

    var testData = [
      {
        template: template,
        model: model[0],
        altModel: { foo: 'a' }
      },
      {
        template: template,
        model: model[1],
        altModel: { foo: 'b' }
      },
      {
        template: template,
        model: model[2],
        altModel: { foo: 'c' }
      }
    ];

    var delegate = {
      getInstanceModel: function(template, model) {
        var data = testData.shift();

        assert.strictEqual(data.template, template);
        assert.strictEqual(data.model, model);
        return data.altModel;
      }
    };

    recursivelySetTemplateModel(div, model, delegate);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(4, div.childNodes.length);
    assert.strictEqual('TEMPLATE', div.childNodes[0].tagName);
    assert.strictEqual('a', div.childNodes[1].textContent);
    assert.strictEqual('b', div.childNodes[2].textContent);
    assert.strictEqual('c', div.childNodes[3].textContent);

    assert.strictEqual(0, testData.length);
  });

  test('getInstanceModel - reorder instances', function() {
    var model = [0, 1, 2];

    var div = createTestHtml(
        '<template repeat syntax="Test">' +
        '{{}}</template>');
    var template = div.firstChild;
    var count = 0;

    var delegate = {
      getInstanceModel: function(template, model) {
        count++;
        return model;
      }
    };

    recursivelySetTemplateModel(div, model, delegate);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(3, count);

    model.reverse();
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(3, count);
  });

  test('Basic', function() {
    var model = { foo: 2, bar: 4 };

    var delegate = {
      getBinding: function(model, path, name, node) {
        var match = path.match(/2x:(.*)/);
        if (match == null)
          return;

        path = match[1].trim();
        var binding = new CompoundBinding(function(values) {
          return values['value'] * 2;
        });

        binding.bind('value', model, path);
        return binding;
      }
    };

    var div = createTestHtml(
        '<template bind>' +
        '{{ foo }} + {{ 2x: bar }} + {{ 4x: bar }}</template>');
    recursivelySetTemplateModel(div, model, delegate);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, div.childNodes.length);
    assert.strictEqual('2 + 8 + ', div.lastChild.textContent);

    model.foo = 4;
    model.bar = 8;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('4 + 16 + ', div.lastChild.textContent);
  });
});