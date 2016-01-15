## Learn the tech

### Why ChangeSummary?

ChangeSummary is a library for observing changes in JavaScript data. It exposes a high-level API and uses Object.observe if available, and otherwise performs dirty-checking.

### Basic Usage

Path observation:

```HTML
var observer = new PathObserver(obj, 'foo.bar.baz', function(newValue, oldValue) {
  // respond to obj.foo.bar.baz having changed value.
});
```

Array observation:

```HTML
var observer = new ArrayObserver(arr, function(splices) {
  // respond to changes to the elements of arr.
  splices.forEach(function(splice) {
    splice.index; // index position that the change occurred.
    splice.removed; // an array of values representing the sequence of elements which were removed
    splice.addedCount; // the number of elements which were inserted.
  });
});
```

Object observation:

```HTML
var observer = new ObjectObserver(obj, function(added, removed, changed, getOldValueFn) {
  // respond to changes to the obj.
  Object.keys(added).forEach(function(property) {
    property; // a property which has been been added to obj
    added[property]; // its value
  });
  Object.keys(removed).forEach(function(property) {
    property; // a property which has been been removed from obj
    getOldValueFn(property); // its old value
  });
  Object.keys(changed).forEach(function(property) {
    property; // a property on obj which has changed value.
    changed[property]; // its value
    getOldValueFn(property); // its old value
  });
});
```
Force delivery of any changes:
```HTML
var obj = { id: 1 }
var observer = new ObjectObserve(obj, function(added, removed, changed, getOldValueFn) {
  // react.
});

obj.id = 2;
observer.deliver(); // causes the callback to be invoked reporting the change in value to obj.id.
```

Reset an observer to discard any previous changes:
```HTML
var arr = [1, 2, 3];
var observer = new ArrayObserver(arr, function(splices) {
  // react.
});

arr.push(4);
observer.reset(); // observer forgets about prior changes
observer.deliver(); // because of the reset, there is nothing to report so callback is not invoked.
```

Close an observer
```HTML
var obj = { foo: { bar: 2 } };
var observer = new PathObserver(arr, function(newValue, oldValue) {
  // react.
});
obj.foo.bar = 3;
observer.close(); // the observer is now invalid and will never fire its callback
```
### About observing paths

`PathObserver` allows code to react to changes to a `path value`. Details:

* If a path is unreachable from the provided object, its value is `undefined`
* If a path is empty (`''`), its value is the object provided
* Path observation respects prototype values.
* `PathObserver.getValueAtPath(obj, 'foo.bar.baz')` is provided in order to retrieve a `path value` without observing it.
* `PathObserver.setValueAtPath(obj, 'foo.bar.baz')` is provided in order to set the `path value`. Setting will create a final property, but not create objects.

### About observing Arrays

`ArrayObserver` allows code to react to changes in the the indexed valued properties of an Array. Details:

* Changes to non-indexed valued properties are not reported (e.g. arr.foo)
* Regardless of what caused the change (e.g. splice(), arr[4] = 4, arr.length = 4), the effects are reported as splices.
* The changes reported are the minimal set of splices required to transform the previous state of arr to the present state.
  * `ArrayObserver.applySplices(splices, copyOfOldArray);` will do actually do this.
* `ArrayObserver` does not respect prototype values.

### About observing Objects

`ObjectObserver` allows code to react to all property changes of a given object. Details:

* Changes are reported as `added`, `removed`, and `changed` properties. Each is an object whose keys are property names and whose values the present value of that property on the object.
* The forth argument (`getOldValueFn`) provided to callback, will retrieve the previous value of a given property if a change to it was reported.
* `ObjectObserver` does not respect prototype values.

## About delivery of changes

ChangeSummary is intended for use in environments which implement Object.observe, but it supports use in environments which do not.

If `Object.observe` is present, and observers have changes to report, their callbacks will be invoked at the end of the current turn (microtask). In a browser environment, this is generally at the end of an event.

If `Object.observe` is absent, `Platform.performMicrotaskCheckpoint()` must be called to trigger delivery of changes. If `Object.observe` is implemented, `Platform.performMicrotaskCheckpoint()` has no effect.
