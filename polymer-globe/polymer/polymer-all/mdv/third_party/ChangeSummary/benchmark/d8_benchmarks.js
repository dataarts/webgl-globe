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

/*
  This is a harness so that the ChangeSummary benchmarks can be run and profiled
  using V8's d8 shell. Doing requires modifying V8's src/object-observe.js to
  expose full delivery of all pending changes to observers via
  Object.deliverAllChangesRecords(). This is *not* a part of the spec and is
  just a hack to allow profiling the benchmarks from d8.
*/

var console = {
  log: print,
  profile: enableProfiler,
  profileEnd: disableProfiler
};

var setTimeout = function(callback) {
  callback();
}

recordCount = 0;

var alert = print;

function reportResults(results) {
  console.log('Avg time: ' + results[0][0]);
}

function reportStatus(setup, variant) {
  console.log('Running: ' + setup + ' object count, ' + variant + ' mutations');
}

function ObserveUnobserveBenchmark() {
  this.objects = [];
}

ObserveUnobserveBenchmark.prototype = {
  __proto__: Benchmark.prototype,

  newObserver: function() {
    return function() {};
  },

  setupTest: function(count) {
    for (var i = 0; i < count; i++) {
      this.objects.push({});
    }
  },

  setupVariant: function(observerCount) {
    this.observers = [];
    for (var i = 0; i < observerCount; i++) {
      this.observers.push(this.newObserver());
    }
  },

  run: function() {
    for (var i = 0; i < this.objects.length; i++) {
      for (var j = 0; j < this.observers.length; j++)
        Object.observe(this.objects[i], this.observers[j]);
    }

    for (var i = 0; i < this.objects.length; i++) {
      for (var j = 0; j < this.observers.length; j++)
        Object.unobserve(this.objects[i], this.observers[j]);
    }
  },

  teardownVariant: function() {},
  teardownTest: function(count) {},
  destroy: function() {}
};

/*
var test = new ArrayBenchmark('update');
var runner = new BenchmarkRunner(test, [6400], [1600],
                                 reportResults, reportStatus);
*/

var test = new ObserveUnobserveBenchmark();
var runner = new BenchmarkRunner(test, [100000], [16],
                                 reportResults, reportStatus);

runner.go();