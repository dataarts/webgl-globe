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

suite('Util: Expression Syntax', function() {

  var testDiv;

  function unbindAll(node) {
    node.unbindAll();
    for (var child = node.firstChild; child; child = child.nextSibling)
      unbindAll(child);
  }

  setup(function() {
    testDiv = document.body.appendChild(document.createElement('div'));
    Observer._errorThrownDuringCallback = false;
  });

  teardown(function() {
    assert.isFalse(!!Observer._errorThrownDuringCallback);
    document.body.removeChild(testDiv);
    unbindAll(testDiv);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual(2, Observer._allObserversCount);
  });

  function hasClass(node, className) {
    return node.className.split(' ').some(function(name) {
      return name === className;
    });
  }

  function assertHasClass(node, className) {
    return assert.isTrue(hasClass(node, className))
  }

  function assertLacksClass(node, className) {
    return assert.isFalse(hasClass(node, className))
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

  function recursivelySetTemplateModel(node, model) {
    HTMLTemplateElement.forAllTemplatesFrom_(node, function(template) {
      template.bindingDelegate = new ExpressionSyntax;
      template.model = model;
    });
  }

  test('ClassName Singular', function() {
    var div = createTestHtml(
        '<template bind><div class="{{ foo: bar }}">' +
        '</div></template>');
    var model = {bar: 1};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    var target = div.childNodes[1];
    assertHasClass(target, 'foo');

    model.bar = 0;
    Platform.performMicrotaskCheckpoint();
    assertLacksClass(target, 'foo');
  });

  test('ClassName Multiple', function() {
    var div = createTestHtml(
        '<template bind>' +
        '<div class="{{ foo: bar; baz: bat > 1; boo: bot.bam }}">' +
        '</div></template>');
    var model = {bar: 1, bat: 1, bot: { bam: 1 }};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    var target = div.childNodes[1];
    assert.strictEqual('foo boo', target.className);
    assertHasClass(target, 'foo');
    assertLacksClass(target, 'baz');
    assertHasClass(target, 'boo');

    model.bar = 0;
    model.bat = 2;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('baz boo', target.className);
    assertLacksClass(target, 'foo');
    assertHasClass(target, 'baz');
    assertHasClass(target, 'boo');
  });

  test('Named Scope Bind', function() {
    var div = createTestHtml(
        '<template bind>' +
          '<template bind="{{ foo.bar as baz }}">' +
            '{{ id }}:{{ baz.bat }}' +
          '</template>' +
        '</template>');
    var model = { id: 'id', foo: { bar: { bat: 'boo' }}};
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('id:boo', div.childNodes[2].textContent);
  });

  test('Named Scope Repeat', function() {
    var div = createTestHtml(
        '<template bind>' +
          '<template repeat="{{ user in users }}">' +
            '{{ id }}:{{ user.name }}' +
          '</template>' +
        '</template>');
    var model = {
      id: 'id',
      users: [
        { name: 'Tim' },
        { name: 'Sally'}
      ]
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('id:Tim', div.childNodes[2].textContent);
    assert.strictEqual('id:Sally', div.childNodes[3].textContent);
  });

  test('Named Scope Deep Nesting', function() {
    var div = createTestHtml(
        '<template bind>' +
          '<template repeat="{{ user in users }}">' +
            '{{ id }}:{{ user.name }}' +
            '<template repeat="{{ employee in user.employees }}">' +
              '{{ id }}:{{ user.name }}:{{ employee.name }}' +
            '</template>' +
          '</template>' +
        '</template>');
    var model = {
      id: 'id',
      users: [
        { name: 'Tim', employees: [{ name: 'Bob'}, { name: 'Sam'}]},
        { name: 'Sally', employees: [{ name: 'Steve' }]}
      ]
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('id:Tim', div.childNodes[2].textContent);
    assert.strictEqual('id:Tim:Bob', div.childNodes[4].textContent);
    assert.strictEqual('id:Tim:Sam', div.childNodes[5].textContent);

    assert.strictEqual('id:Sally', div.childNodes[6].textContent);
    assert.strictEqual('id:Sally:Steve', div.childNodes[8].textContent);
  });

  test('Named Scope Unnamed resets', function() {
    var div = createTestHtml(
        '<template bind>' +
          '<template bind="{{ foo as bar }}">' +
            '{{ bar.id }}' +
            '<template bind="{{ bar.bat }}">' +
              '{{ boo }}:{{ bar.id }}' +
            '</template>' +
          '</template>' +
        '</template>');
    var model = {
      foo: {
        id: 2,
        bat: {
          boo: 'bot'
        }
      },
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();

    assert.strictEqual('2', div.childNodes[2].textContent);
    assert.strictEqual('bot:', div.childNodes[4].textContent);
  });

  test('Expressions Arithmetic, + - / *', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ (a.b + c.d)/e - f * g.h }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: {
        d: 5
      },
      e: 2,
      f: 3,
      g: {
        h: 2
      }
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('-1', div.childNodes[1].textContent);

    model.a.b = 11;
    model.f = -2;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('12', div.childNodes[1].textContent);
  });

  test('Expressions Unary - +', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ (-a.b) - (+c) }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: 3
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('-8', div.childNodes[1].textContent);

    model.a.b = -1;
    model.c = -4;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('5', div.childNodes[1].textContent);
  });

  test('Expressions Logical !', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ !a.b }}:{{ !c }}:{{ !d }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: '',
      d: false
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('false:true:true', div.childNodes[1].textContent);

    model.a.b = 0;
    model.c = 'foo'
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('true:false:true', div.childNodes[1].textContent);
  });

  test('Expressions Arithmetic, Additive', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ (a.b + c.d) - (f + g.h) }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: {
        d: 5
      },
      e: 2,
      f: 3,
      g: {
        h: 2
      }
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('5', div.childNodes[1].textContent);

    model.a.b = 7;
    model.g.h = -5;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('14', div.childNodes[1].textContent);
  });

  test('Expressions Arithmetic, Multiplicative', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ (a.b * c.d) / (f % g.h) }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: {
        d: 6
      },
      e: 2,
      f: 8,
      g: {
        h: 5
      }
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('10', div.childNodes[1].textContent);

    model.a.b = 10;
    model.f = 16;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('60', div.childNodes[1].textContent);
  });

  test('Expressions Relational', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ a.b > c }}:{{ a.b < c }}:{{ c >= d }}:{{ d <= e }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: 3,
      d: 3,
      e: 2
    };
    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('true:false:true:false', div.childNodes[1].textContent);

    model.a.b = 1;
    model.d = -5;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('false:true:true:true', div.childNodes[1].textContent);
  });

  test('Expressions Equality', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ a.b == c }}:{{ a.b != c }}:{{ c === d }}:{{ d !== e }}' +
        '</template>');
    var model = {
      a: {
        b: 5
      },
      c: '5',
      d: {}
    };
    model.e = model.d;

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('true:false:false:false', div.childNodes[1].textContent);

    model.a.b = 3;
    model.e = {};
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('false:true:false:true', div.childNodes[1].textContent);
  });

  test('Expressions Binary Logical', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ a.b && c }}:{{ a.b || c }}:{{ c && d }}:{{ d || e }}' +
        '</template>');
    var model = {
      a: {
        b: 0
      },
      c: 5,
      d: true,
      e: ''
    };

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('0:5:true:true', div.childNodes[1].textContent);

    model.a.b = true;
    model.d = 0;
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('5:true:0:', div.childNodes[1].textContent);
  });

  test('Expressions Conditional', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ a.b ? c : d.e }}:{{ f ? g.h : i }}' +
        '</template>');
    var model = {
      a: {
        b: 1
      },
      c: 5,
      d: {
        e: 2
      },
      f: 0,
      g: {
        h: 'foo'
      },
      i: 'bar'
    };

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('5:bar', div.childNodes[1].textContent);

    model.c = 6;
    model.f = '';
    model.i = 'bat'
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('6:bat', div.childNodes[1].textContent);
  });

  test('Expressions Literals', function() {
    var div = createTestHtml(
        '<template bind>' +
            '{{ +1 }}:{{ "foo" }}:{{ true ? true : false }}:' +
            '{{ true ? null : false}}' +
        '</template>');
    var model = {};

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1:foo:true:null', div.childNodes[1].textContent);
  });

  test('Expressions Array Literals', function() {
    var div = createTestHtml(
        '<template repeat="{{ [foo, bar] }}">' +
            '{{}}' +
        '</template>');

    var model = {
      foo: 'bar',
      bar: 'bat'
    };

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('bar', div.childNodes[1].textContent);
    assert.strictEqual('bat', div.childNodes[2].textContent);

    model.foo = 'boo';
    model.bar = 'blat';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('boo', div.childNodes[1].textContent);
    assert.strictEqual('blat', div.childNodes[2].textContent);
  });

  test('Expressions Object Literals', function() {
    var div = createTestHtml(
        '<template bind="{{ { \'id\': 1, foo: bar } }}">' +
            '{{id}}:{{foo}}' +
        '</template>');

    var model = {
      bar: 'bat'
    };

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1:bat', div.childNodes[1].textContent);

    model.bar = 'blat';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1:blat', div.childNodes[1].textContent);
  });

  test('Expressions Array Literals, Named Scope', function() {
    var div = createTestHtml(
        '<template repeat="{{ user in [foo, bar] }}">' +
            '{{ user }}' +
        '</template>');

    var model = {
      foo: 'bar',
      bar: 'bat'
    };

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('bar', div.childNodes[1].textContent);
    assert.strictEqual('bat', div.childNodes[2].textContent);

    model.foo = 'boo';
    model.bar = 'blat';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('boo', div.childNodes[1].textContent);
    assert.strictEqual('blat', div.childNodes[2].textContent);
  });

  test('Expressions Object Literals, Named Scope', function() {
    var div = createTestHtml(
        '<template bind="{{ { \'id\': 1, foo: bar } as t }}">' +
            '{{t.id}}:{{t.foo}}' +
        '</template>');

    var model = {
      bar: 'bat'
    };

    recursivelySetTemplateModel(div, model);
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1:bat', div.childNodes[1].textContent);

    model.bar = 'blat';
    Platform.performMicrotaskCheckpoint();
    assert.strictEqual('1:blat', div.childNodes[1].textContent);
  });
});
