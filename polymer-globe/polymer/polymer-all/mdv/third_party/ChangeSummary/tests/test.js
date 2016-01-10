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

var observer;
var callbackArgs = undefined;
var callbackInvoked = false;

function callback() {
  callbackArgs = Array.prototype.slice.apply(arguments);
  callbackInvoked = true;
}

function doSetup() {}
function doTeardown() {
  callbackInvoked = false;
  callbackArgs = undefined;
}

function assertNoChanges() {
  if (observer)
    observer.deliver();
  assert.isFalse(callbackInvoked);
  assert.isUndefined(callbackArgs);
}

var createObject = ('__proto__' in {}) ?
  function(obj) { return obj; } :
  function(obj) {
    var proto = obj.__proto__;
    if (!proto)
      return obj;
    var newObject = Object.create(proto);
    Object.getOwnPropertyNames(obj).forEach(function(name) {
      Object.defineProperty(newObject, name,
                           Object.getOwnPropertyDescriptor(obj, name));
    });
    return newObject;
  };

suite('Basic Tests', function() {

  test('Exception Doesnt Stop Notification', function() {
    var model = [1];
    var count = 0;

    var observer1 = new ObjectObserver(model, function() {
      count++;
    });

    var observer2 = new PathObserver(model, '0', function() {
      count++;
    });

    var observer3 = new ArrayObserver(model, function() {
      count++;
    });

    model[0] = 2;
    model[1] = 2;

    observer1.deliver();
    observer2.deliver();
    observer3.deliver();

    assert.equal(3, count);

    observer1.close();
    observer2.close();
    observer3.close();
  });

  test('No Object.observe performMicrotaskCheckpoint', function() {
    if (typeof Object.observe == 'function')
      return;

    var model = [1];
    var count = 0;

    var observer1 = new ObjectObserver(model, function() {
      count++;
    });

    var observer2 = new PathObserver(model, '0', function() {
      count++;
    });

    var observer3 = new ArrayObserver(model, function() {
      count++;
    });

    model[0] = 2;
    model[1] = 2;

    Platform.performMicrotaskCheckpoint();
    assert.equal(3, count);

    observer1.close();
    observer2.close();
    observer3.close();
  });
});

suite('PathObserver Tests', function() {

  setup(doSetup);

  teardown(doTeardown);

  function assertPathChanges(expectNewValue, expectOldValue) {
    observer.deliver();

    assert.isTrue(callbackInvoked);

    var newValue = callbackArgs[0];
    var oldValue = callbackArgs[1];
    assert.deepEqual(expectNewValue, newValue);
    assert.deepEqual(expectOldValue, oldValue);

    callbackArgs = undefined;
    callbackInvoked = false;
  }

  test('Close Invokes Unobserved', function() {
    var called = false;
    var obj = { foo: 1, unobserved: function() { called = true }};
    var observer = new PathObserver(obj, 'foo', function() {});
    observer.close();
    assert.isTrue(called);
  });

  test('Optional target for callback', function() {
    var returnedToken;
    var target = {
      changed: function(value, oldValue, token) {
        this.called = true;
        returnedToken = token;
      }
    };
    var obj = { foo: 1 };
    var observer = new PathObserver(obj, 'foo', target.changed, target, 'token');
    obj.foo = 2;
    observer.deliver();
    assert.isTrue(target.called);
    assert.strictEqual('token', returnedToken)

    observer.close();
  });

  test('Delivery Until No Changes', function() {
    var obj = { foo: { bar: 5 }};
    var callbackCount = 0;
    var observer = new PathObserver(obj, 'foo.bar', function() {
      callbackCount++;
      if (!obj.foo.bar)
        return;

      obj.foo.bar--;
    });

    obj.foo.bar--;
    observer.deliver();

    assert.equal(5, callbackCount);

    observer.close();
  });

  test('Path disconnect', function() {
    var arr = {};

    arr.foo = 'bar';
    observer = new PathObserver(arr, 'foo', callback);
    arr.foo = 'baz';

    assertPathChanges('baz', 'bar');
    arr.foo = 'bar';

    observer.close();
    arr.foo = 'boo';
    assertNoChanges();
  });

  test('Path reset', function() {
    var arr = {};

    arr.foo = 'bar';
    observer = new PathObserver(arr, 'foo', callback);
    arr.foo = 'baz';

    assertPathChanges('baz', 'bar');

    arr.foo = 'bat';
    observer.reset();
    assertNoChanges();

    arr.foo = 'bag';
    assertPathChanges('bag', 'bat');
    observer.close();
  });

  test('Degenerate Values', function() {
    observer = new PathObserver(null, '', callback);
    assert.equal(null, observer.value);
    assert.equal(null, PathObserver.getValueAtPath(null, ''));
    observer.close();

    var foo = {};
    observer = new PathObserver(foo, '', callback);
    assert.equal(foo, observer.value);
    assert.equal(foo, PathObserver.getValueAtPath(foo, ''));
    observer.close();

    observer = new PathObserver(3, '', callback);
    assert.equal(3, observer.value);
    assert.equal(3, PathObserver.getValueAtPath(3, ''));
    observer.close();

    observer = new PathObserver(undefined, 'a', callback);
    assert.equal(undefined, observer.value);
    assert.equal(undefined, PathObserver.getValueAtPath(undefined, 'a'));
    observer.close();

    var bar = { id: 23 };
    observer = new PathObserver(undefined, 'a/3!', callback);
    assert.equal(undefined, observer.value);
    assert.equal(undefined, PathObserver.getValueAtPath(bar, 'a/3!'));
    observer.close();
  });

  test('Path NaN', function() {
    var foo = { val: 1 };
    observer = new PathObserver(foo, 'val', callback);
    foo.val = 0/0;

    // Can't use assertSummary because deepEqual() will fail with NaN
    observer.deliver();
    assert.isTrue(callbackInvoked);
    assert.isTrue(isNaN(callbackArgs[0]));
    assert.strictEqual(1, callbackArgs[1]);
    observer.close();
  });

  test('Path GetValueAtPath', function() {
    var obj = {
      a: {
        b: {
          c: 1
        }
      }
    };

    assert.strictEqual(obj.a, PathObserver.getValueAtPath(obj, 'a'));
    assert.strictEqual(obj.a.b, PathObserver.getValueAtPath(obj, 'a.b'));
    assert.strictEqual(1, PathObserver.getValueAtPath(obj, 'a.b.c'));

    obj.a.b.c = 2;
    assert.strictEqual(2, PathObserver.getValueAtPath(obj, 'a.b.c'));

    obj.a.b = {
      c: 3
    };
    assert.strictEqual(3, PathObserver.getValueAtPath(obj, 'a.b.c'));

    obj.a = {
      b: 4
    };
    assert.strictEqual(undefined, PathObserver.getValueAtPath(obj, 'a.b.c'));
    assert.strictEqual(4, PathObserver.getValueAtPath(obj, 'a.b'));
  });

  test('Path SetValueAtPath', function() {
    var obj = {};
    PathObserver.setValueAtPath(obj, 'foo', 3);
    assert.equal(3, obj.foo);

    var bar = { baz: 3 };

    PathObserver.setValueAtPath(obj, 'bar', bar);
    assert.equal(bar, obj.bar);

    PathObserver.setValueAtPath(obj, 'bar.baz.bat', 'not here');
    assert.equal(undefined, PathObserver.getValueAtPath(obj, 'bar.baz.bat'));
  });

  test('Path Set Value Back To Same', function() {
    var obj = {};
    PathObserver.setValueAtPath(obj, 'foo', 3);
    assert.equal(3, obj.foo);

    observer = new PathObserver(obj, 'foo', callback);
    assert.equal(3, observer.value);

    PathObserver.setValueAtPath(obj, 'foo', 2);
    observer.reset();
    assert.equal(2, observer.value);

    PathObserver.setValueAtPath(obj, 'foo', 3);
    observer.reset();
    assert.equal(3, observer.value);

    assertNoChanges();

    observer.close();
  });

  test('Path Triple Equals', function() {
    var model = { };

    observer = new PathObserver(model, 'foo', callback);

    model.foo = null;
    assertPathChanges(null, undefined);

    model.foo = undefined;
    assertPathChanges(undefined, null);

    observer.close();
  });

  test('Path Simple', function() {
    var model = { };

    observer = new PathObserver(model, 'foo', callback);

    model.foo = 1;
    assertPathChanges(1, undefined);

    model.foo = 2;
    assertPathChanges(2, 1);

    delete model.foo;
    assertPathChanges(undefined, 2);

    observer.close();
  });

  test('Path With Indices', function() {
    var model = [];

    observer = new PathObserver(model, '0', callback);

    model.push(1);
    assertPathChanges(1, undefined);

    observer.close();
  });

  test('Path Observation', function() {
    var model = {
      a: {
        b: {
          c: 'hello, world'
        }
      }
    };

    observer = new PathObserver(model, 'a.b.c', callback);

    model.a.b.c = 'hello, mom';
    assertPathChanges('hello, mom', 'hello, world');

    model.a.b = {
      c: 'hello, dad'
    };
    assertPathChanges('hello, dad', 'hello, mom');

    model.a = {
      b: {
        c: 'hello, you'
      }
    };
    assertPathChanges('hello, you', 'hello, dad');

    model.a.b = 1;
    assertPathChanges(undefined, 'hello, you');

    // Stop observing
    observer.close();

    model.a.b = {c: 'hello, back again -- but not observing'};
    assertNoChanges();

    // Resume observing
    observer = new PathObserver(model, 'a.b.c', callback);

    model.a.b.c = 'hello. Back for reals';
    assertPathChanges('hello. Back for reals',
        'hello, back again -- but not observing');

    observer.close();
  });

  test('Path Set To Same As Prototype', function() {
    var model = createObject({
      __proto__: {
        id: 1
      }
    });

    observer = new PathObserver(model, 'id', callback);
    model.id = 1;

    assertNoChanges();
    observer.close();
  });

  test('Path Set Read Only', function() {
    var model = {};
    Object.defineProperty(model, 'x', {
      configurable: true,
      writable: false,
      value: 1
    });
    observer = new PathObserver(model, 'x', callback);

    model.x = 2;

    assertNoChanges();
    observer.close();
  });

  test('Path Set Shadows', function() {
    var model = createObject({
      __proto__: {
        x: 1
      }
    });

    observer = new PathObserver(model, 'x', callback);
    model.x = 2;
    assertPathChanges(2, 1);
    observer.close();
  });

  test('Delete With Same Value On Prototype', function() {
    var model = createObject({
      __proto__: {
        x: 1,
      },
      x: 1
    });

    observer = new PathObserver(model, 'x', callback);
    delete model.x;
    assertNoChanges();
    observer.close();
  });

  test('Delete With Different Value On Prototype', function() {
    var model = createObject({
      __proto__: {
        x: 1,
      },
      x: 2
    });

    observer = new PathObserver(model, 'x', callback);
    delete model.x;
    assertPathChanges(1, 2);
    observer.close();
  });

  test('Value Change On Prototype', function() {
    var proto = {
      x: 1
    }
    var model = createObject({
      __proto__: proto
    });

    observer = new PathObserver(model, 'x', callback);
    model.x = 2;
    assertPathChanges(2, 1);

    delete model.x;
    assertPathChanges(1, 2);

    proto.x = 3;
    assertPathChanges(3, 1);
    observer.close();
  });

  // FIXME: Need test of observing change on proto.

  test('Delete Of Non Configurable', function() {
    var model = {};
    Object.defineProperty(model, 'x', {
      configurable: false,
      value: 1
    });

    observer = new PathObserver(model, 'x', callback);

    delete model.x;
    assertNoChanges();
    observer.close();
  });

  test('Notify', function() {
    if (typeof Object.getNotifier !== 'function')
      return;

    var model = {
      a: {}
    }

    var _b = 2;

    Object.defineProperty(model.a, 'b', {
      get: function() { return _b; },
      set: function(b) {
        Object.getNotifier(this).notify({
          type: 'updated',
          name: 'b',
          oldValue: _b
        });

        _b = b;
      }
    });

    observer = new PathObserver(model, 'a.b', callback);
    _b = 3; // won't be observed.
    assertNoChanges();

    model.a.b = 4; // will be observed.
    assertPathChanges(4, 2);

    observer.close();
  });

  test('DefineProperty Cascade', function() {
    var root = {
      value: 1,
      a: {
        b: {}
      },
      c: {}
    };

    var a = {};
    var b = {};
    var c = {};

    root.a.observer = PathObserver.defineProperty(root.a, 'value', {
      object: root,
      path: 'value'
    });

    root.a.b.observer = PathObserver.defineProperty(root.a.b, 'value', {
      object: root.a,
      path: 'value'
    });

    root.c.observer = PathObserver.defineProperty(root.c, 'value', {
      object: root,
      path: 'value'
    });

    root.c.value = 2;
    assert.strictEqual(2, root.a.b.value);

    root.a.observer.close();
    root.a.b.observer.close();
    root.c.observer.close();
  });

  test('DefineProperty', function() {
    var source = { foo: { bar: 1 }};
    var target = {};
    var changeRecords;
    var callback;
    if (typeof Object.observe === 'function') {
      changeRecords = [];
      callback = function(records) {
        Array.prototype.push.apply(changeRecords, records);
      };

      Object.observe(target, callback);
    }

    var observer = PathObserver.defineProperty(target, 'computed', {
      object: source,
      path: 'foo.bar'
    });
    assert.isTrue(target.hasOwnProperty('computed'));
    assert.strictEqual(1, target.computed);

    target.computed = 2;
    assert.strictEqual(2, source.foo.bar);

    source.foo.bar = 3;
    assert.strictEqual(3, target.computed);

    source.foo.bar = 4;
    target.computed = 5;
    assert.strictEqual(5, target.computed);

    target.computed = 6;
    source.foo.bar = 7;
    assert.strictEqual(7, target.computed);

    delete source.foo;
    target.computed = 8;
    assert.isUndefined(target.computed);

    source.foo = { bar: 9 };
    assert.strictEqual(9, target.computed);

    observer.close();
    assert.isTrue(target.hasOwnProperty('computed'));
    assert.strictEqual(9, target.computed);

    if (!changeRecords)
      return;

    Object.deliverChangeRecords(callback);
    assert.deepEqual(changeRecords, [
      {
        object: target,
        name: 'computed',
        type: 'new'
      },
      {
        object: target,
        name: 'computed',
        type: 'updated',
        oldValue: 1
      },
      {
        object: target,
        name: 'computed',
        type: 'deleted'
        // TODO(rafaelw): When notifer.performChange() is implemented, this can
        // a synthetic record can be sent with the correct value.
        // oldValue: 9
      }
    ]);

    Object.unobserve(target, callback);
  });

  test('DefineProperty - empty path', function() {
    var target = {}
    var observer = PathObserver.defineProperty(target, 'foo', {
      object: 1,
      path: ''
    });
    assert.isTrue(target.hasOwnProperty('foo'));
    assert.strictEqual(1, target.foo);

    var obj = {};
    var observer2 = PathObserver.defineProperty(target, 'bar', {
      object: obj,
      path: ''
    });
    assert.isTrue(target.hasOwnProperty('bar'));
    assert.strictEqual(obj, target.bar);
  });
});

suite('ArrayObserver Tests', function() {

  setup(doSetup);

  teardown(doTeardown);

  function ensureNonSparse(arr) {
    for (var i = 0; i < arr.length; i++) {
      if (i in arr)
        continue;
      arr[i] = undefined;
    }
  }

  function assertArrayChanges(expectSplices) {
    observer.deliver();
    var splices = callbackArgs[0];

    assert.isTrue(callbackInvoked);

    splices.forEach(function(splice) {
      ensureNonSparse(splice.removed);
    });

    expectSplices.forEach(function(splice) {
      ensureNonSparse(splice.removed);
    });

    assert.deepEqual(expectSplices, splices);
    callbackArgs = undefined;
    callbackInvoked = false;
  }

  function applySplicesAndAssertDeepEqual(orig, copy) {
    observer.deliver();
    if (callbackInvoked) {
      var splices = callbackArgs[0];
      ArrayObserver.applySplices(copy, orig, splices);
    }

    ensureNonSparse(orig);
    ensureNonSparse(copy);
    assert.deepEqual(orig, copy);
    callbackArgs = undefined;
    callbackInvoked = false;
  }

  function assertEditDistance(orig, expectDistance) {
    observer.deliver();
    var splices = callbackArgs[0];
    var actualDistance = 0;

    if (callbackInvoked) {
      splices.forEach(function(splice) {
        actualDistance += splice.addedCount + splice.removed.length;
      });
    }

    assert.deepEqual(expectDistance, actualDistance);
    callbackArgs = undefined;
    callbackInvoked = false;
  }

  function arrayMutationTest(arr, operations) {
    var copy = arr.slice();
    observer = new ArrayObserver(arr, callback);
    operations.forEach(function(op) {
      switch(op.name) {
        case 'delete':
          delete arr[op.index];
          break;

        case 'update':
          arr[op.index] = op.value;
          break;

        default:
          arr[op.name].apply(arr, op.args);
          break;
      }
    });

    applySplicesAndAssertDeepEqual(arr, copy);
    observer.close();
  }

  test('Close Invokes Unobserved', function() {
    var called = false;
    var obj = [];
    obj.unobserved = function() { called = true };
    var observer = new ArrayObserver(obj, function() {});
    observer.close();
    assert.isTrue(called);
  });

  test('Optional target for callback', function() {
    var returnedToken;
    var target = {
      changed: function(splices, token) {
        this.called = true;
        returnedToken = token;
      }
    };
    var obj = [];
    var observer = new ArrayObserver(obj, target.changed, target, 'token');
    obj.length = 1;
    observer.deliver();
    assert.isTrue(target.called);
    assert.strictEqual('token', returnedToken);
    observer.close();
  });

  test('Delivery Until No Changes', function() {
    var arr = [0, 1, 2, 3, 4];
    var callbackCount = 0;
    var observer = new ArrayObserver(arr, function() {
      callbackCount++;
      arr.shift();
    });

    arr.shift();
    observer.deliver();

    assert.equal(5, callbackCount);

    observer.close();
  });

  test('Array disconnect', function() {
    var arr = [ 0 ];

    observer = new ArrayObserver(arr, callback);

    arr[0] = 1;

    assertArrayChanges([{
      index: 0,
      removed: [0],
      addedCount: 1
    }]);

    observer.close();
    arr[1] = 2;
    assertNoChanges();
  });

  test('Array reset', function() {
    var arr = [];

    arr.push(1);
    observer = new ArrayObserver(arr, callback);
    arr.push(2);

    assertArrayChanges([{
      index: 1,
      removed: [],
      addedCount: 1
    }]);

    arr.push(3);
    observer.reset();
    assertNoChanges();

    arr.pop();
    assertArrayChanges([{
      index: 2,
      removed: [3],
      addedCount: 0
    }]);
    observer.close();
  });

  test('Array', function() {
    var model = [0, 1];

    observer = new ArrayObserver(model, callback);

    model[0] = 2;

    assertArrayChanges([{
      index: 0,
      removed: [0],
      addedCount: 1
    }]);

    model[1] = 3;
    assertArrayChanges([{
      index: 1,
      removed: [1],
      addedCount: 1
    }]);

    observer.close();
  });

  test('Array observe non-array throws', function() {
    assert.throws(function () {
      observer = new ArrayObserver({}, callback);
    });
  });

  test('Array Set Same', function() {
    var model = [1];

    observer = new ArrayObserver(model, callback);

    model[0] = 1;

    observer.close();
  });

  test('Array Splice', function() {
    var model = [0, 1]

    observer = new ArrayObserver(model, callback);

    model.splice(1, 1, 2, 3); // [0, 2, 3]
    assertArrayChanges([{
      index: 1,
      removed: [1],
      addedCount: 2
    }]);

    model.splice(0, 1); // [2, 3]
    assertArrayChanges([{
      index: 0,
      removed: [0],
      addedCount: 0
    }]);

    model.splice();
    assertNoChanges();

    model.splice(0, 0);
    assertNoChanges();

    model.splice(0, -1);
    assertNoChanges();

    model.splice(-1, 0, 1.5); // [2, 1.5, 3]
    assertArrayChanges([{
      index: 1,
      removed: [],
      addedCount: 1
    }]);

    model.splice(3, 0, 0); // [2, 1.5, 3, 0]
    assertArrayChanges([{
      index: 3,
      removed: [],
      addedCount: 1
    }]);

    model.splice(0); // []
    assertArrayChanges([{
      index: 0,
      removed: [2, 1.5, 3, 0],
      addedCount: 0
    }]);

    observer.close();
  });

  test('Array Splice Truncate And Expand With Length', function() {
    var model = ['a', 'b', 'c', 'd', 'e'];

    observer = new ArrayObserver(model, callback);

    model.length = 2;

    assertArrayChanges([{
      index: 2,
      removed: ['c', 'd', 'e'],
      addedCount: 0
    }]);

    model.length = 5;

    assertArrayChanges([{
      index: 2,
      removed: [],
      addedCount: 3
    }]);

    observer.close();
  });

  test('Array Splice Delete Too Many', function() {
    var model = ['a', 'b', 'c'];

    observer = new ArrayObserver(model, callback);

    model.splice(2, 3); // ['a', 'b']
    assertArrayChanges([{
      index: 2,
      removed: ['c'],
      addedCount: 0
    }]);

    observer.close();
  });

  test('Array Length', function() {
    var model = [0, 1];

    observer = new ArrayObserver(model, callback);

    model.length = 5; // [0, 1, , , ,];
    assertArrayChanges([{
      index: 2,
      removed: [],
      addedCount: 3
    }]);

    model.length = 1;
    assertArrayChanges([{
        index: 1,
        removed: [1, , , ,],
        addedCount: 0
    }]);

    model.length = 1;
    assertNoChanges();

    observer.close();
  });

  test('Array Push', function() {
    var model = [0, 1];

    observer = new ArrayObserver(model, callback);

    model.push(2, 3); // [0, 1, 2, 3]
    assertArrayChanges([{
      index: 2,
      removed: [],
      addedCount: 2
    }]);

    model.push();
    assertNoChanges();

    observer.close();
  });

  test('Array Pop', function() {
    var model = [0, 1];

    observer = new ArrayObserver(model, callback);

    model.pop(); // [0]
    assertArrayChanges([{
      index: 1,
      removed: [1],
      addedCount: 0
    }]);

    model.pop(); // []
    assertArrayChanges([{
      index: 0,
      removed: [0],
      addedCount: 0
    }]);

    model.pop();
    assertNoChanges();

    observer.close();
  });

  test('Array Shift', function() {
    var model = [0, 1];

    observer = new ArrayObserver(model, callback);

    model.shift(); // [1]
    assertArrayChanges([{
      index: 0,
      removed: [0],
      addedCount: 0
    }]);

    model.shift(); // []
    assertArrayChanges([{
      index: 0,
      removed: [1],
      addedCount: 0
    }]);

    model.shift();
    assertNoChanges();

    observer.close();
  });

  test('Array Unshift', function() {
    var model = [0, 1];

    observer = new ArrayObserver(model, callback);

    model.unshift(-1); // [-1, 0, 1]
    assertArrayChanges([{
      index: 0,
      removed: [],
      addedCount: 1
    }]);

    model.unshift(-3, -2); // []
    assertArrayChanges([{
      index: 0,
      removed: [],
      addedCount: 2
    }]);

    model.unshift();
    assertNoChanges();

    observer.close();
  });

  test('Array Tracker Contained', function() {
    arrayMutationTest(
        ['a', 'b'],
        [
          { name: 'splice', args: [1, 1] },
          { name: 'unshift', args: ['c', 'd', 'e'] },
          { name: 'splice', args: [1, 2, 'f'] }
        ]
    );
  });

  test('Array Tracker Delete Empty', function() {
    arrayMutationTest(
        [],
        [
          { name: 'delete', index: 0 },
          { name: 'splice', args: [0, 0, 'a', 'b', 'c'] }
        ]
    );
  });

  test('Array Tracker Right Non Overlap', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'splice', args: [0, 1, 'e'] },
          { name: 'splice', args: [2, 1, 'f', 'g'] }
        ]
    );
  });

  test('Array Tracker Left Non Overlap', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'splice', args: [3, 1, 'f', 'g'] },
          { name: 'splice', args: [0, 1, 'e'] }
        ]
    );
  });

  test('Array Tracker Right Adjacent', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'splice', args: [1, 1, 'e'] },
          { name: 'splice', args: [2, 1, 'f', 'g'] }
        ]
    );
  });

  test('Array Tracker Left Adjacent', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'splice', args: [2, 2, 'e'] },
          { name: 'splice', args: [1, 1, 'f', 'g'] }
        ]
    );
  });

  test('Array Tracker Right Overlap', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'splice', args: [1, 1, 'e'] },
          { name: 'splice', args: [1, 1, 'f', 'g'] }
        ]
    );
  });

  test('Array Tracker Left Overlap', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          // a b [e f g] d
          { name: 'splice', args: [2, 1, 'e', 'f', 'g'] },
          // a [h i j] f g d
          { name: 'splice', args: [1, 2, 'h', 'i', 'j'] }
        ]
    );
  });

  test('Array Tracker Prefix And Suffix One In', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'unshift', args: ['z'] },
          { name: 'push', arg: ['z'] }
        ]
    );
  });

  test('Array Tracker Shift One', function() {
    arrayMutationTest(
        [16, 15, 15],
        [
          { name: 'shift', args: ['z'] }
        ]
    );
  });

  test('Array Tracker Update Delete', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'splice', args: [2, 1, 'e', 'f', 'g'] },
          { name: 'update', index: 0, value: 'h' },
          { name: 'delete', index: 1 }
        ]
    );
  });

  test('Array Tracker Update After Delete', function() {
    arrayMutationTest(
        ['a', 'b', undefined, 'd'],
        [
          { name: 'update', index: 2, value: 'e' }
        ]
    );
  });

  test('Array Tracker Delete Mid Array', function() {
    arrayMutationTest(
        ['a', 'b', 'c', 'd'],
        [
          { name: 'delete', index: 2 }
        ]
    );
  });

  test('Array Random Case 1', function() {
    var model = ['a','b'];
    var copy = model.slice();

    observer = new ArrayObserver(model, callback);

    model.splice(0, 1, 'c', 'd', 'e');
    model.splice(4,0,'f');
    model.splice(3,2);

    applySplicesAndAssertDeepEqual(model, copy);
  });

  test('Array Random Case 2', function() {
    var model = [3,4];
    var copy = model.slice();

    observer = new ArrayObserver(model, callback);

    model.splice(2,0,8);
    model.splice(0,1,0,5);
    model.splice(2,2);

    applySplicesAndAssertDeepEqual(model, copy);
  });

  test('Array Random Case 3', function() {
    var model = [1,3,6];
    var copy = model.slice();

    observer = new ArrayObserver(model, callback);

    model.splice(1,1);
    model.splice(0,2,1,7);
    model.splice(1,0,3,7);

    applySplicesAndAssertDeepEqual(model, copy);
  });

  test('Array Tracker Fuzzer', function() {
    var testCount = 64;

    console.log('Fuzzing spliceProjection ' + testCount +
                ' passes with ' + ArrayFuzzer.operationCount + ' operations each.');

    for (var i = 0; i < testCount; i++) {
      console.log('pass: ' + i);
      var fuzzer = new ArrayFuzzer();
      fuzzer.go();
      ensureNonSparse(fuzzer.arr);
      ensureNonSparse(fuzzer.copy);
      assert.deepEqual(fuzzer.arr, fuzzer.copy);
    }
  });

  test('Array Tracker No Proxies Edits', function() {
    model = [];
    observer = new ArrayObserver(model, callback);
    model.length = 0;
    model.push(1, 2, 3);
    assertEditDistance(model, 3);
    observer.close();

    model = ['x', 'x', 'x', 'x', '1', '2', '3'];
    observer = new ArrayObserver(model, callback);
    model.length = 0;
    model.push('1', '2', '3', 'y', 'y', 'y', 'y');
    assertEditDistance(model, 8);
    observer.close();

    model = ['1', '2', '3', '4', '5'];
    observer = new ArrayObserver(model, callback);
    model.length = 0;
    model.push('a', '2', 'y', 'y', '4', '5', 'z', 'z');
    assertEditDistance(model, 7);
    observer.close();
  });
});

suite('ObjectObserver Tests', function() {

  setup(doSetup);

  teardown(doTeardown);

  function assertObjectChanges(expect) {
    observer.deliver();

    assert.isTrue(callbackInvoked);

    var added = callbackArgs[0];
    var removed = callbackArgs[1];
    var changed = callbackArgs[2];
    var getOldValue = callbackArgs[3];
    var oldValues = {};

    function collectOldValues(type) {
      Object.keys(type).forEach(function(prop) {
        oldValues[prop] = getOldValue(prop);
      });
    };
    collectOldValues(added);
    collectOldValues(removed);
    collectOldValues(changed);

    assert.deepEqual(expect.added, added);
    assert.deepEqual(expect.removed, removed);
    assert.deepEqual(expect.changed, changed);
    assert.deepEqual(expect.oldValues, oldValues);

    callbackArgs = undefined;
    callbackInvoked = false;
  }

  test('Close Invokes Unobserved', function() {
    var called = false;
    var obj = {};
    obj.unobserved = function() { called = true };
    var observer = new ObjectObserver(obj, function() {});
    observer.close();
    assert.isTrue(called);
  });

  test('Optional target for callback', function() {
    var returnedToken;
    var target = {
      changed: function(value, oldValue, token) {
        this.called = true;
        returnedToken = token;
      }
    };
    var obj = { foo: 1 };
    var observer = new PathObserver(obj, 'foo', target.changed, target, 'token');
    obj.foo = 2;
    observer.deliver();
    assert.isTrue(target.called);
    assert.strictEqual('token', returnedToken)

    observer.close();
  });

  test('Optional target for callback', function() {
    var returnedToken;
    var target = {
      changed: function(added, removed, changed, oldValues, token) {
        this.called = true;
        returnedToken = token;
      }
    };
    var obj = {};
    var observer = new ObjectObserver(obj, target.changed, target, 'token');
    obj.foo = 1;
    observer.deliver();
    assert.isTrue(target.called);
    assert.strictEqual('token', returnedToken)

    observer.close();
  });

  test('Delivery Until No Changes', function() {
    var obj = { foo: 5 };
    var callbackCount = 0;
    var observer = new ObjectObserver(obj, function() {
      callbackCount++;
      if (!obj.foo)
        return;

      obj.foo--;
    });

    obj.foo--;
    observer.deliver();

    assert.equal(5, callbackCount);

    observer.close();
  });

  test('Object disconnect', function() {
    var obj = {};

    obj.foo = 'bar';
    observer = new ObjectObserver(obj, callback);

    obj.foo = 'baz';
    obj.bat = 'bag';
    obj.blaz = 'foo';

    delete obj.foo;
    delete obj.blaz;

    assertObjectChanges({
      added: {
        'bat': 'bag'
      },
      removed: {
        'foo': undefined
      },
      changed: {},
      oldValues: {
        'foo': 'bar',
        'bat': undefined
      }
    });

    obj.foo = 'blarg';

    observer.close();

    obj.bar = 'blaz';
    assertNoChanges();
  });

  test('Object reset', function() {
    var obj = {};

    obj.foo = 'bar';
    observer = new ObjectObserver(obj, callback);
    obj.foo = 'baz';

    assertObjectChanges({
      added: {},
      removed: {},
      changed: {
        foo: 'baz'
      },
      oldValues: {
        foo: 'bar'
      }
    });

    obj.blaz = 'bat';
    observer.reset();
    assertNoChanges();

    obj.bat = 'bag';
    assertObjectChanges({
      added: {
        bat: 'bag'
      },
      removed: {},
      changed: {},
      oldValues: {
        bat: undefined
      }
    });
    observer.close();
  });

  test('Object observe array', function() {
    var arr = [];

    observer = new ObjectObserver(arr, callback);

    arr.length = 5;
    arr.foo = 'bar';
    arr[3] = 'baz';

    assertObjectChanges({
      added: {
        foo: 'bar',
        '3': 'baz'
      },
      removed: {},
      changed: {
        'length': 5
      },
      oldValues: {
        length: 0,
        foo: undefined,
        '3': undefined
      }
    });

    observer.close();
  });

  test('Object', function() {
    var model = {};

    observer = new ObjectObserver(model, callback);
    model.id = 0;
    assertObjectChanges({
      added: {
        id: 0
      },
      removed: {},
      changed: {},
      oldValues: {
        id: undefined
      }
    });

    delete model.id;
    assertObjectChanges({
      added: {},
      removed: {
        id: undefined
      },
      changed: {},
      oldValues: {
        id: 0
      }
    });

    // Stop observing -- shouldn't see an event
    observer.close();
    model.id = 101;
    assertNoChanges();

    // Re-observe -- should see an new event again.
    observer = new ObjectObserver(model, callback);
    model.id2 = 202;;
    assertObjectChanges({
      added: {
        id2: 202
      },
      removed: {},
      changed: {},
      oldValues: {
        id2: undefined
      }
    });

    observer.close();
  });

  test('Object Delete Add Delete', function() {
    var model = { id: 1 };

    observer = new ObjectObserver(model, callback);

    // If mutation occurs in seperate "runs", two events fire.
    delete model.id;
    assertObjectChanges({
      added: {},
      removed: {
        id: undefined
      },
      changed: {},
      oldValues: {
        id: 1
      }
    });

    model.id = 1;
    assertObjectChanges({
      added: {
        id: 1
      },
      removed: {},
      changed: {},
      oldValues: {
        id: undefined
      }
    });

    // If mutation occurs in the same "run", no events fire (nothing changed).
    delete model.id;
    model.id = 1;
    assertNoChanges();

    observer.close();
  });

  test('Object Set Undefined', function() {
    var model = {};

    observer = new ObjectObserver(model, callback);

    model.x = undefined;
    assertObjectChanges({
      added: {
        x: undefined
      },
      removed: {},
      changed: {},
      oldValues: {
        x: undefined
      }
    });

    observer.close();
  });
});
