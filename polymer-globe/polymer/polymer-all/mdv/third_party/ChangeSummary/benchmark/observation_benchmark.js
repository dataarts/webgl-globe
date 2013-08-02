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

(function(global) {
  'use strict';

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

  function ObservationBenchmark() {
    Benchmark.call(this);
    this.objects = [];
    this.observers = []
    this.index = 0;
    this.mutationCount = 0;
    this.boundObserverCallback = this.observerCallback.bind(this);
  }

  ObservationBenchmark.prototype = createObject({
    __proto__: Benchmark.prototype,

    setupTest: function(objectCount) {
      while (this.objects.length < objectCount) {
        var obj = this.newObject();
        this.objects.push(obj);
        this.observers.push(this.newObserver(obj));
      }
    },

    run: function(mutationCount) {
      while (mutationCount > 0) {
        var obj = this.objects[this.index];
        mutationCount += -this.mutateObject(obj, mutationCount);
        this.mutationCount++;
        this.index++;
        if (this.index >= this.objects.length)
          this.index = 0;
      }
    },

    teardownVariant: function() {
      if (this.mutationCount !== 0)
        alert('Error: mutationCount == ' + this.mutationCount);
    },

    observerCallback: function() {
      this.mutationCount--;
    },

    destroy: function() {
      for (var i = 0; i < this.observers.length; i++) {
        var observer = this.observers[i];
        observer.close();
      }
    }
  });

  function ObjectBenchmark() {
    ObservationBenchmark.call(this);
    this.properties = [];
    for (var i = 0; i < ObjectBenchmark.propertyCount; i++) {
      this.properties.push(String.fromCharCode(97 + i));
    }
  }

  ObjectBenchmark.configs = [];
  ObjectBenchmark.propertyCount = 15;

  ObjectBenchmark.prototype = createObject({
    __proto__: ObservationBenchmark.prototype,

    newObject: function() {
      var obj = {};
      for (var j = 0; j < ObjectBenchmark.propertyCount; j++)
        obj[this.properties[j]] = j;

      return obj;
    },

    newObserver: function(obj) {
      return new ObjectObserver(obj, this.boundObserverCallback);
    },

    mutateObject: function(obj) {
      var size = Math.floor(ObjectBenchmark.propertyCount / 3);
      for (var i = 0; i < size; i++) {
        obj[this.properties[i]]++;
      }

      return size;
    }
  });

  function ArrayBenchmark(config) {
    ObservationBenchmark.call(this);
    var tokens = config.split('/');
    this.operation = tokens[0];
    this.undo = tokens[1];
  };

  ArrayBenchmark.configs = ['splice', 'update', 'push/pop', 'shift/unshift'];
  ArrayBenchmark.elementCount = 100;

  ArrayBenchmark.prototype = createObject({
    __proto__: ObservationBenchmark.prototype,

    newObject: function() {
      var array = [];
      for (var i = 0; i < ArrayBenchmark.elementCount; i++)
        array.push(i);
      return array;
    },

    newObserver: function(array) {
      return new ArrayObserver(array, this.boundObserverCallback);
    },

    mutateObject: function(array) {
      switch (this.operation) {
        case 'update':
          var mutationsMade = 0;
          var size = Math.floor(ArrayBenchmark.elementCount / 10);
          for (var j = 0; j < size; j++) {
            array[j*size] += 1;
            mutationsMade++;
          }
          return mutationsMade;

        case 'splice':
          var size = Math.floor(ArrayBenchmark.elementCount / 5);
          var removed = array.splice(size, size);
          Array.prototype.splice.apply(array, [size*2, 0].concat(removed));
          return size * 2;

        default:
          var val = array[this.undo]();
          array[this.operation](val + 1);
          return 2;
      }
    }
  });

  function PathBenchmark(config) {
    ObservationBenchmark.call(this);
    this.leaf = config === 'leaf';
    this.pathParts = ['foo', 'bar', 'baz'];
    this.pathString = this.pathParts.join('.');
  }

  PathBenchmark.configs = ['leaf', 'root'];

  PathBenchmark.prototype = createObject({
    __proto__: ObservationBenchmark.prototype,

    newPath: function(parts, value) {
      var obj = {};
      var ref = obj;
      var prop;
      for (var i = 0; i < parts.length - 1; i++) {
        prop = parts[i];
        ref[prop] = {};
        ref = ref[prop];
      }

      prop = parts[parts.length - 1];
      ref[prop] = value;

      return obj;
    },

    newObject: function() {
      return this.newPath(this.pathParts, 1);
    },

    newObserver: function(obj) {
      return new PathObserver(obj, this.pathString, this.boundObserverCallback);
    },

    mutateObject: function(obj) {
      var val = PathObserver.getValueAtPath(obj, this.pathString);
      if (this.leaf) {
        PathObserver.setValueAtPath(obj, this.pathString, val + 1);
      } else {
        PathObserver.setValueAtPath(obj, this.pathParts[0],
            this.newPath(this.pathParts.slice(1), val + 1));
      }

      return 1;
    }
  });

  global.ObjectBenchmark = ObjectBenchmark;
  global.ArrayBenchmark = ArrayBenchmark;
  global.PathBenchmark = PathBenchmark;

})(this);