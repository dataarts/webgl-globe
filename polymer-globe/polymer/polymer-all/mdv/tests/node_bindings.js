// Copyright 2013 Google Inc.

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

// Note: DOMNodeInserted/Removed only fire in webkit if the node is rooted in
// document. This is just an attachment point so that tests will pass in
// webkit.
var testDiv;

function unbindAll(node) {
  node.unbindAll();
  for (var child = node.firstChild; child; child = child.nextSibling)
    unbindAll(child);
}

function doSetup() {
  testDiv = document.body.appendChild(document.createElement('div'));
}

function doTeardown() {
  assert.isFalse(!!Observer._errorThrownDuringCallback);
  document.body.removeChild(testDiv);
  unbindAll(testDiv);
  Platform.performMicrotaskCheckpoint();
  assert.strictEqual(2, Observer._allObserversCount);
}

function dispatchEvent(type, target) {
  var event = document.createEvent('Event');
  event.initEvent(type, true, false);
  target.dispatchEvent(event);
  Platform.performMicrotaskCheckpoint();
}

suite('Text bindings', function() {

  setup(doSetup);
  teardown(doTeardown);

  test('Text', function() {
    var text = document.createTextNode('hi');
    var model = {a: 1};
    text.bind('textContent', model, 'a');
    assert.strictEqual('1', text.data);

    model.a = 2;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('2', text.data);

    text.unbind('textContent');
    model.a = 3;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('2', text.data);

    // TODO(rafaelw): Throw on binding to unavailable property?
  });

  test('Path unreachable', function() {
    var text = testDiv.appendChild(document.createTextNode('hi'));
    var model = {};
    text.bind('textContent', model, 'a');
    assert.strictEqual(text.data, '');
  });
});

suite('Element attribute bindings', function() {

  setup(doSetup);
  teardown(doTeardown);

  test('Basic', function() {
    var el = testDiv.appendChild(document.createElement('div'));
    var model = {a: '1'};
    el.bind('foo', model, 'a');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1', el.getAttribute('foo'));

    model.a = '2';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('2', el.getAttribute('foo'));

    model.a = 232.2;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('232.2', el.getAttribute('foo'));

    model.a = 232;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('232', el.getAttribute('foo'));

    model.a = null;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('', el.getAttribute('foo'));

    model.a = undefined;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('', el.getAttribute('foo'));
  });

  test('Dashes', function() {
    var el = testDiv.appendChild(document.createElement('div'));
    var model = {a: '1'};
    el.bind('foo-bar', model, 'a');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1', el.getAttribute('foo-bar'));

    model.a = '2';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('2', el.getAttribute('foo-bar'));
  });

  test('Element.id, Element.hidden?', function() {
    var element = testDiv.appendChild(document.createElement('div'));
    var model = {a: 1, b: 2};
    element.bind('hidden?', model, 'a');
    element.bind('id', model, 'b');

    assert.isTrue(element.hasAttribute('hidden'));
    assert.strictEqual('', element.getAttribute('hidden'));
    assert.strictEqual('2', element.id);

    model.a = null;
    Platform.performMicrotaskCheckpoint();
    assert.isFalse(element.hasAttribute('hidden'));

    model.a = 'foo';
    model.b = 'x';
    Platform.performMicrotaskCheckpoint();
    assert.isTrue(element.hasAttribute('hidden'));
    assert.strictEqual('', element.getAttribute('hidden'));
    assert.strictEqual('x', element.id);
  });

  test('Element.id - path unreachable', function() {
    var element = testDiv.appendChild(document.createElement('div'));
    var model = {};
    element.bind('id', model, 'a');
    assert.strictEqual(element.id, '');
  });
});

suite('Form Element Bindings', function() {

  setup(doSetup);
  teardown(doTeardown);

  function inputTextAreaValueTest(type) {
    var el = testDiv.appendChild(document.createElement(type));
    var model = {x: 42};
    el.bind('value', model, 'x');
    assert.strictEqual('42', el.value);

    model.x = 'Hi';
    assert.strictEqual('42', el.value);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('Hi', el.value);

    el.value = 'changed';
    dispatchEvent('input', el);
    assert.strictEqual('changed', model.x);

    el.unbind('value');

    el.value = 'changed again';
    dispatchEvent('input', el);
    assert.strictEqual('changed', model.x);

    el.bind('value', model, 'x');
    model.x = null;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('', el.value);
  }

  test('Input.value', function() {
    inputTextAreaValueTest('input');
  });

  test('TextArea.value', function() {
    inputTextAreaValueTest('textarea');
  });

  test('Input.value - user value rejected', function() {
    var model = {val: 'ping'};

    var el = testDiv.appendChild(document.createElement('input'));
    el.bind('value', model, 'val');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('ping', el.value);

    el.value = 'pong';
    dispatchEvent('input', el);
    assert.strictEqual('pong', model.val);

    // Try a deep path.
    model = {
      a: {
        b: {
          c: 'ping'
        }
      }
    };

    el.bind('value', model, 'a.b.c');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('ping', el.value);

    el.value = 'pong';
    dispatchEvent('input', el);
    assert.strictEqual('pong', PathObserver.getValueAtPath(model, 'a.b.c'));

    // Start with the model property being absent.
    delete model.a.b.c;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('', el.value);

    el.value = 'pong';
    dispatchEvent('input', el);
    assert.strictEqual('pong', PathObserver.getValueAtPath(model, 'a.b.c'));
    Platform.performMicrotaskCheckpoint();

    // Model property unreachable (and unsettable).
    delete model.a.b;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('', el.value);

    el.value = 'pong';
    dispatchEvent('input', el);
    assert.strictEqual(undefined, PathObserver.getValueAtPath(model, 'a.b.c'));
  });

  test('(Checkbox)Input.checked', function() {
    var input = testDiv.appendChild(document.createElement('input'));
    testDiv.appendChild(input);
    input.type = 'checkbox';
    var model = {x: true};
    input.bind('checked', model, 'x');
    assert.isTrue(input.checked);

    model.x = false;
    assert.isTrue(input.checked);
    Platform.performMicrotaskCheckpoint();
    assert.isFalse(input.checked);

    input.click();
    assert.isTrue(model.x);
    Platform.performMicrotaskCheckpoint();

    input.click();
    assert.isFalse(model.x);
  });

  test('(Checkbox)Input.checked 2', function() {
    var model = {val: true};

    var el = testDiv.appendChild(document.createElement('input'));
    testDiv.appendChild(el);
    el.type = 'checkbox';
    el.bind('checked', model, 'val');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(true, el.checked);

    model.val = false;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(false, el.checked);

    el.click();
    assert.strictEqual(true, model.val);

    el.click();
    assert.strictEqual(false, model.val);

    el.addEventListener('click', function() {
      assert.strictEqual(true, model.val);
    });
    el.addEventListener('change', function() {
      assert.strictEqual(true, model.val);
    });

    var event = document.createEvent('MouseEvent');
    event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false,
        false, false, false, 0, null);
    el.dispatchEvent(event);
  });

  test('(Checkbox)Input.checked - binding updated on click', function() {
    var model = {val: true};

    var el = testDiv.appendChild(document.createElement('input'));
    testDiv.appendChild(el);
    el.type = 'checkbox';
    el.bind('checked', model, 'val');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(true, el.checked);

    el.addEventListener('click', function() {
      assert.strictEqual(false, model.val);
    });

    var event = document.createEvent('MouseEvent');
    event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false,
        false, false, false, 0, null);
    el.dispatchEvent(event);
  });

  test('(Checkbox)Input.checked - binding updated on change', function() {
    var model = {val: true};

    var el = testDiv.appendChild(document.createElement('input'));
    testDiv.appendChild(el);
    el.type = 'checkbox';
    el.bind('checked', model, 'val');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(true, el.checked);

    el.addEventListener('change', function() {
      assert.strictEqual(false, model.val);
    });

    var event = document.createEvent('MouseEvent');
    event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false,
        false, false, false, 0, null);
    el.dispatchEvent(event);
  });

  test('(Radio)Input.checked', function() {
    var input = testDiv.appendChild(document.createElement('input'));
    input.type = 'radio';
    var model = {x: true};
    input.bind('checked', model, 'x');
    assert.isTrue(input.checked);

    model.x = false;
    assert.isTrue(input.checked);
    Platform.performMicrotaskCheckpoint();
    assert.isFalse(input.checked);

    input.checked = true;
    dispatchEvent('change', input);
    assert.isTrue(model.x);

    input.unbind('checked');

    input.checked = false;
    dispatchEvent('change', input);
    assert.isTrue(model.x);
  });

  test('(Radio)Input.checked 2', function() {
    var model = {val1: true, val2: false, val3: false, val4: true};
    var RADIO_GROUP_NAME = 'test';

    var container = testDiv.appendChild(document.createElement('div'));

    var el1 = container.appendChild(document.createElement('input'));
    el1.type = 'radio';
    el1.name = RADIO_GROUP_NAME;
    el1.bind('checked', model, 'val1');

    var el2 = container.appendChild(document.createElement('input'));
    el2.type = 'radio';
    el2.name = RADIO_GROUP_NAME;
    el2.bind('checked', model, 'val2');

    var el3 = container.appendChild(document.createElement('input'));
    el3.type = 'radio';
    el3.name = RADIO_GROUP_NAME;
    el3.bind('checked', model, 'val3');

    var el4 = container.appendChild(document.createElement('input'));
    el4.type = 'radio';
    el4.name = 'othergroup';
    el4.bind('checked', model, 'val4');

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(true, el1.checked);
    assert.strictEqual(false, el2.checked);
    assert.strictEqual(false, el3.checked);
    assert.strictEqual(true, el4.checked);

    model.val1 = false;
    model.val2 = true;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(false, el1.checked);
    assert.strictEqual(true, el2.checked);
    assert.strictEqual(false, el3.checked);
    assert.strictEqual(true, el4.checked);

    el1.checked = true;
    dispatchEvent('change', el1);
    assert.strictEqual(true, model.val1);
    assert.strictEqual(false, model.val2);
    assert.strictEqual(false, model.val3);
    assert.strictEqual(true, model.val4);

    el3.checked = true;
    dispatchEvent('change', el3);
    assert.strictEqual(false, model.val1);
    assert.strictEqual(false, model.val2);
    assert.strictEqual(true, model.val3);
    assert.strictEqual(true, model.val4);
  });

  test('(Radio)Input.checked - multiple forms', function() {
    var model = {val1: true, val2: false, val3: false, val4: true};
    var RADIO_GROUP_NAME = 'test';

    var container = testDiv.appendChild(document.createElement('div'));
    var form1 = container.appendChild(document.createElement('form'));
    var form2 = container.appendChild(document.createElement('form'));

    var el1 = form1.appendChild(document.createElement('input'));
    el1.type = 'radio';
    el1.name = RADIO_GROUP_NAME;
    el1.bind('checked', model, 'val1');

    var el2 = form1.appendChild(document.createElement('input'));
    el2.type = 'radio';
    el2.name = RADIO_GROUP_NAME;
    el2.bind('checked', model, 'val2');

    var el3 = form2.appendChild(document.createElement('input'));
    el3.type = 'radio';
    el3.name = RADIO_GROUP_NAME;
    el3.bind('checked', model, 'val3');

    var el4 = form2.appendChild(document.createElement('input'));
    el4.type = 'radio';
    el4.name = RADIO_GROUP_NAME;
    el4.bind('checked', model, 'val4');

    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(true, el1.checked);
    assert.strictEqual(false, el2.checked);
    assert.strictEqual(false, el3.checked);
    assert.strictEqual(true, el4.checked);

    el2.checked = true;
    dispatchEvent('change', el2);
    assert.strictEqual(false, model.val1);
    assert.strictEqual(true, model.val2);

    // Radio buttons in form2 should be unaffected
    assert.strictEqual(false, model.val3);
    assert.strictEqual(true, model.val4);

    el3.checked = true;
    dispatchEvent('change', el3);
    assert.strictEqual(true, model.val3);
    assert.strictEqual(false, model.val4);

    // Radio buttons in form1 should be unaffected
    assert.strictEqual(false, model.val1);
    assert.strictEqual(true, model.val2);
  });

  test('Select.selectedIndex', function() {
    var select = testDiv.appendChild(document.createElement('select'));
    testDiv.appendChild(select);
    var option0 = select.appendChild(document.createElement('option'));
    var option1 = select.appendChild(document.createElement('option'));
    var option2 = select.appendChild(document.createElement('option'));

    var model = {
      val: 2
    };

    select.bind('selectedIndex', model, 'val');
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, select.selectedIndex);

    select.selectedIndex = 1;
    dispatchEvent('change', select);
    assert.strictEqual(1, model.val);
  });
});
