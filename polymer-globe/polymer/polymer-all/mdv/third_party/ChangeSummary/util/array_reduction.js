// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

function ArrayReduction(array, path, reduceFn, initial) {
  var values = [];
  var observers = [];
  var self = this;
  var hasInitial = arguments.length == 4;

  function reduce() {
    self.value = hasInitial ?
      values.reduce(reduceFn, initial) : values.reduce(reduceFn);
  }

  function newCallback(index) {
    return function(value) {
      values[index] = value;
      reduce();
    }
  }

  function handleSplice(splice) {
    var valueArgs = [splice.index, splice.removed.length];
    var observerArgs = [splice.index, splice.removed.length];

    var removeIndex = splice.index;
    while (removeIndex < splice.index + splice.removed.length) {
      observers[removeIndex].close();
      observers[removeIndex] = undefined;
      removeIndex++;
    }

    var addIndex = splice.index;
    while (addIndex < splice.index + splice.addedCount) {
      var itemPath = String(addIndex);
      if (path)
        itemPath += '.' + path;

      valueArgs.push(PathObserver.getValueAtPath(array, itemPath));
      observerArgs.push(new PathObserver(array, itemPath, newCallback(addIndex)));
      addIndex++;
    }

    Array.prototype.splice.apply(values, valueArgs);
    Array.prototype.splice.apply(observers, observerArgs);
  }

  var arrayObserver = new ArrayObserver(array, function(splices) {
    splices.forEach(handleSplice);
    reduce();
  });

  handleSplice({
    index: 0,
    removed: [],
    addedCount: array.length
  });

  this.close = function() {
    observers.forEach(function(observer) {
      observer.close();
    });
    arrayObserver.close();
  };

  this.unobserved = function() {
    self.close();
  };

  this.deliver = function() {
    arrayObserver.deliver();
    observers.forEach(function(observer) {
      observer.deliver();
    });
  }

  reduce();
}

ArrayReduction.defineProperty = function(object, name, descriptor) {
  var observer;
  if (descriptor.hasOwnProperty('initial'))
    observer = new ArrayReduction(descriptor.array, descriptor.path, descriptor.reduce, descriptor.initial);
  else
    observer = new ArrayReduction(descriptor.array, descriptor.path, descriptor.reduce);

  Object.defineProperty(object, name, {
    get: function() {
      observer.deliver();
      return observer.value;
    }
  });

  if (typeof Object.observe !== 'function')
    return;

  var value = observer.value;
  Object.defineProperty(observer, 'value', {
    get: function() {
      return value;
    },
    set: function(newValue) {
      Object.getNotifier(object).notify({
        object: object,
        type: 'updated',
        name: name,
        oldValue: value
      });
      value = newValue;
    }
  })

  return observer;
}