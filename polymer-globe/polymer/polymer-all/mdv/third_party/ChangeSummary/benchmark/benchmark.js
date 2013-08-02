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

  // IE10 & below don't have mutation observers. Just synchronously invoke
  // callbackFn in this case. Each test iteration with unroll the stack with
  // a setTimeout so that it doesn't get too deep.
  var hasMutationObserver = typeof global.MutationObserver === 'function';

  var hasForceGc = typeof global.gc === 'function';

  function EndOfMicrotaskRunner(callbackFn) {
    if (hasMutationObserver) {
      var observer = new MutationObserver(callbackFn);
      var div = document.createElement('div');
      observer.observe(div, { attributes: true });
      var pingPong = true;
    }

    this.schedule = function() {
      if (hasMutationObserver) {
        div.setAttribute('ping', pingPong);
        pingPong = !pingPong;
      } else {
        callbackFn();
      }
    };
  }

  function BenchmarkRunner(benchmark, tests, variants, completeFn, statusFn) {
    this.benchmark = benchmark;
    this.tests = tests;
    this.variants = variants;
    this.test = 0;
    this.variant = 0;
    this.completeFn = completeFn;
    this.statusFn = statusFn;
    this.results = [];
    this.microtaskRunner =
      new EndOfMicrotaskRunner(this.runFinished.bind(this));

  }

  BenchmarkRunner.INIT = 0;
  BenchmarkRunner.ESTIMATE = 1;
  BenchmarkRunner.TESTING = 2;
  BenchmarkRunner.maxTime = 400;
  BenchmarkRunner.maxRuns = 50;

  var hasPerformance = typeof global.performance === 'object' &&
                       typeof global.performance.now === 'function'

  BenchmarkRunner.prototype = {
    now: function() {
      return hasPerformance ? performance.now() : Date.now();
    },

    go: function() {
      this.nextVariant();
    },

    nextVariant: function() {
      // Done with all
      if (this.test === this.tests.length) {
        this.benchmark.destroy();

        var self = this;
        setTimeout(function() {
          Platform.performMicrotaskCheckpoint();
          self.completeFn(self.results);
        });
        return;
      }

      // Configure this test.
      if (this.variant === 0) {
        this.times = [];
        this.benchmark.setupTest(this.tests[this.test]);
      }

      this.benchmark.setupVariant(this.variants[this.variant]);

      // Run the test once before timing.
      this.runSeries(BenchmarkRunner.INIT, 1);
    },

    variantComplete: function(duration) {
      this.times.push(duration);

      this.statusFn(this.tests[this.test], this.variants[this.variant],
                    this.runCount);

      this.benchmark.teardownVariant(this.variants[this.variant]);
      this.variant++;

      if (this.variant == this.variants.length) {
        this.results.push(this.times);
        this.benchmark.teardownTest(this.tests[this.test]);
        this.test++;
        this.variant = 0;
      }

      var self = this;
      setTimeout(function() {
        Platform.performMicrotaskCheckpoint();
        self.nextVariant();
      }, 0);
    },

    runSeries: function(state, count) {
      this.state = state;
      this.runCount = count;
      this.remaining = count;
      if (hasForceGc) {
        global.gc();
        global.gc();
        global.gc();
      }
      this.start = this.now();
      this.runOne();
    },

    runOne: function() {
      this.benchmark.run(this.variants[this.variant], this);
      this.microtaskRunner.schedule();
    },

    runFinished: function() {
      Platform.performMicrotaskCheckpoint();

      this.remaining--;
      if (this.remaining > 0) {
        this.runOne();
        return;
      }

      var duration = (this.now() - this.start) / this.runCount;

      switch (this.state) {
        case BenchmarkRunner.INIT:
          // Run the test twice to estimate its time.
          this.runSeries(BenchmarkRunner.ESTIMATE, 2);
          break;

        case BenchmarkRunner.ESTIMATE:
          // Run as many tests as will fit in maxTime.
          var testingRuns =
              Math.min(Math.round(BenchmarkRunner.maxTime/duration),
                       BenchmarkRunner.maxRuns);

          if (testingRuns >= 4)
            this.runSeries(BenchmarkRunner.TESTING, testingRuns);
          else
            this.variantComplete(duration);
          break;
        case BenchmarkRunner.TESTING:
          this.variantComplete(duration);
          break;
      }
    }
  }

  function Benchmark() {}

  Benchmark.prototype = {
    setupTest: function(setup) {},
    setupVariant: function(variant) {},
    run: function(variant) {},
    teardownVariant: function(variant) {},
    teardownTest: function(test) {},
    destroy: function() {}
  };

  global.BenchmarkRunner = BenchmarkRunner;
  global.Benchmark = Benchmark;

})(this);