/**
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {

setup(function() {}, {explicit_timeout: true});

/**
 * Schedule something to be called at a given time.
 *
 * @constructor
 * @param {number} millis Microseconds after start at which the callback should
 *   be called.
 * @param {bool} autostart Auto something...
 */
function TestTimelineGroup(millis) {
  this.millis = millis;

  /**
   * @type {bool}
   */
  this.autorun_ = false;

  /**
   * @type {!Array.<function(): ?Object>}
   */
  this.startCallbacks = null;

  /**
   * Callbacks which are added after the timeline has started. We clear them
   * when going backwards.
   *
   * @type {?Array.<function(): ?Object>}
   */
  this.lateCallbacks = null;

  /**
   * @type {Element}
   */
  this.marker = document.createElement('img');
  /**
   * @type {Element}
   */
  this.info = document.createElement('div');

  this.setup_();
}

TestTimelineGroup.prototype.setup_ = function() {
  this.endTime_ = 0;
  this.startCallbacks = new Array();
  this.lateCallbacks = null;
  this.marker.innerHTML = '';
  this.info.innerHTML = '';
}

/**
 * Add a new callback to the event group
 *
 * @param {function(): ?Object} callback Callback given the currentTime of
 *   callback.
 */
TestTimelineGroup.prototype.add = function(callback) {
  if (this.lateCallbacks === null) {
    this.startCallbacks.unshift(callback);
  } else {
    this.lateCallbacks.unshift(callback);
  }

  // Trim out extra 'function() { ... }'
  var callbackString = callback.name;
  // FIXME: This should probably unindent too....
  this.info.innerHTML += '<div>' + callbackString + '</div>';
};

/**
 * Reset this event group to the state before start was called.
 */
TestTimelineGroup.prototype.reset = function() {
  this.lateCallbacks = null;

  var callbacks = this.startCallbacks.slice(0);
  this.setup_();
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    this.add(callback);
  }
};

/**
 * Tell the event group that the timeline has started and that any callbacks
 * added from now are dynamically generated and hence should be cleared when a
 * reset is called.
 */
TestTimelineGroup.prototype.start = function() {
  this.lateCallbacks = new Array();
};

/**
 * Call all the callbacks in the EventGroup.
 */
TestTimelineGroup.prototype.call = function() {
  var callbacks = (this.startCallbacks.slice(0)).concat(this.lateCallbacks);
  var statuses = this.info.children;

  var overallResult = true;
  while (callbacks.length > 0) {
    var callback = callbacks.pop();

    var status_ = statuses[statuses.length - callbacks.length - 1];

    if (typeof callback == 'function') {
      callback();
    } else {
      var result = callback.step(callback.f);
      callback.done();
    }

    if (result === undefined || result == null) {
      overallResult = overallResult && true;

      status_.style.color = 'green';
    } else {
      overallResult = overallResult && false;
      status_.style.color = 'red';
      status_.innerHTML += '<div>' + result.toString() + '</div>';
    }
  }
  if (overallResult) {
    this.marker.src = '../img/success.png';
  } else {
    this.marker.src = '../img/error.png';
  }
}

/**
 * Draw the EventGroup's marker at the correct position on the timeline.
 *
 * FIXME(mithro): This mixes display and control :(
 *
 * @param {number} endTime The endtime of the timeline in millis. Used to
 *   display the marker at the right place on the timeline.
 */
TestTimelineGroup.prototype.draw = function(container, endTime) {
  this.marker.title = this.millis + 'ms';
  this.marker.className = 'marker';
  this.marker.src = '../img/unknown.png';
  this.marker.style.left = 'calc(' + (this.millis / endTime) * 100.0 +
               '%' + ' - 10px)';
  container.appendChild(this.marker);

  this.info.className = 'info';
  container.appendChild(this.info);

  // Display details about the events at this time period when hovering over
  // the marker.
  this.marker.onmouseover = function() {
    this.style.display = 'block';
  }.bind(this.info);

  this.marker.onmouseout = function() {
    this.style.display = 'none';
  }.bind(this.info);

  this.info.style.left = 'calc(' + (this.millis / endTime) * 100.0 + '%' +
      ' - ' + this.info.offsetWidth / 2 + 'px)';
  this.info.style.display = 'none';
};

/**
 * Class for storing events that happen during at given times (such as
 * animation checks, or setTimeout).
 *
 * @constructor
 */
function TestTimeline(everyFrame) {
  /**
   * Stores the events which are upcoming.
   *
   * @type Object.<number, TestTimelineGroup>
   * @private
   */
  this.timeline_ = new Array();

  this.everyFrame = everyFrame;
  this.frameMillis = 1000.0 / 60; //60fps

  this.currentTime_ = -this.frameMillis;

  // Schedule an event at t=0, needed temporarily.
  this.schedule(function() {}, 0);

  this.reset();
}

/**
 * Create the GUI controller for the timeline.
 * @param {Element} body DOM element to add the GUI too, normally the <body>
 *   element.
 */
TestTimeline.prototype.createGUI = function(body) {
  // HTML needed to create the timeline UI
  this.div = document.createElement('div');
  this.div.id = 'timeline';

  this.timelinebar = document.createElement('div');
  this.timelinebar.className = 'bar';

  this.timelineprogress = document.createElement('div');
  this.timelineprogress.className = 'progress';

  this.timelinebar.appendChild(this.timelineprogress);
  this.div.appendChild(this.timelinebar);

  this.next = document.createElement('button');
  this.next.innerText = '>';
  this.next.id = 'next';
  this.next.onclick = this.toNextEvent.bind(this);
  this.div.appendChild(this.next);

  this.prev = document.createElement('button');
  this.prev.innerText = '<';
  this.prev.id = 'prev';
  this.prev.onclick = this.toPrevEvent.bind(this);
  this.div.appendChild(this.prev);

  body.appendChild(this.div);
}

/**
 * Update GUI elements.
 *
 * @private
 */
TestTimeline.prototype.updateGUI = function () {
  // Update the timeline
  this.timelineprogress.style.width = (this.currentTime_ / this.endTime_) * 100.0 +'%';
  this.timelinebar.title = (this.currentTime_).toFixed(0) + 'ms';
};


/**
 * Sort the timeline into run order. Should be called after adding something to
 * the timeline.
 *
 * @private
 */
TestTimeline.prototype.sort_ = function() {
  this.timeline_.sort(function(a,b) {
    return a.millis - b.millis;
  });
};

/**
 * Schedule something to be called at a given time.
 *
 * @param {function(number)} callback Callback to call after the number of millis
 *   have elapsed.
 * @param {number} millis Milliseconds after start at which the callback should
 *   be called.
 */
TestTimeline.prototype.schedule = function(callback, millis) {
  if (millis < this.currentTime_) {
    // Can't schedule something in the past?
    return;
  }

  // See if there is something at that time in the timeline already?
  var timeline = this.timeline_.slice(0);
  var group = null;
  while (timeline.length > 0) {
    if (timeline[0].millis == millis) {
      group = timeline[0];
      break;
    } else {
      timeline.shift();
    }
  }

  // If not, create a node at that time.
  if (group === null) {
    group = new TestTimelineGroup(millis);
    this.timeline_.unshift(group);
    this.sort_();
  }
  group.add(callback);

  var newEndTime = this.timeline_.slice(-1)[0].millis * 1.1;
  if (this.endTime_ != newEndTime) {
    this.endTime_ = newEndTime;
  }
};

/**
 * Return the current time in milliseconds.
 */
TestTimeline.prototype.now = function() {
  return Math.max(this.currentTime_, 0);
};

/**
 * Set the current time to a given value.
 *
 * @param {number} millis Time in milliseconds to set the current time too.
 */
TestTimeline.prototype.setTime = function(millis) {
  // Time is going backwards, we actually have to reset and go forwards as
  // events can cause the creation of more events.
  if (this.currentTime_ > millis) {
    this.reset();
    this.start();
  }

  var events = this.timeline_.slice(0);

  // Already processed events
  while (events.length > 0 && events[0].millis <= this.currentTime_) {
    events.shift();
  }

  while (this.currentTime_ < millis) {
    var event_ = null;
    var moveTo = millis;

    if (events.length > 0 && events[0].millis <= millis) {
      event_ = events.shift();
      moveTo = event_.millis;
    }

    // Call the callback
    if (this.currentTime_ != moveTo) {
      this.currentTime_ = moveTo;
      this.animationFrame(this.currentTime_);
    }

    if (event_) {
      event_.call();
    }
  }

  this.updateGUI();
};

/**
 * Call all callbacks registered for the next (virtual) animation frame.
 *
 * @param {number} millis Time in milliseconds.
 * @private
 */
TestTimeline.prototype.animationFrame = function(millis) {
  /* FIXME(mithro): Code should appear here to allow testing of running
   * every animation frame.

  if (this.everyFrame) {
  }

  */

  var callbacks = this.animationFrameCallbacks;
  callbacks.reverse();
  this.animationFrameCallbacks = [];
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i](millis);
  }
};

/**
 * Set a callback to run at the next (virtual) animation frame.
 *
 * @param {function(millis)} millis Time in milliseconds to set the current
 *   time too.
 */
TestTimeline.prototype.requestAnimationFrame = function(callback) {
  // FIXME: This should return a reference that allows people to cancel the
  // animationFrame callback.
  this.animationFrameCallbacks.push(callback);
  return -1;
};

/**
 * Go to next scheduled event in timeline.
 */
TestTimeline.prototype.toNextEvent = function() {
  var events = this.timeline_.slice(0);
  while (events.length > 0 && events[0].millis <= this.currentTime_) {
    events.shift();
  }
  if (events.length > 0) {
    this.setTime(events[0].millis);

    if (this.autorun_) {
      this.toNextEvent();
    }

    return true;
  } else {
    this.setTime(this.endTime_);
    return false;
  }

};

/**
 * Go to previous scheduled event in timeline.
 * (This actually goes back to time zero and then forward to this event.)
 */
TestTimeline.prototype.toPrevEvent = function() {
  var events = this.timeline_.slice(0);
  while (events.length > 0 &&
         events[events.length - 1].millis >= this.currentTime_) {
    events.pop();
  }
  if (events.length > 0) {
    this.setTime(events[events.length - 1].millis);
    return true;
  } else {
    this.setTime(0);
    return false;
  }
};

/**
 * Reset the timeline to time zero.
 */
TestTimeline.prototype.reset = function () {
  for (var t in this.timeline_) {
    this.timeline_[t].reset();
  }

  this.currentTime_ = -this.frameMillis;
  this.animationFrameCallbacks = [];
  this.started_ = false;
};

/**
 * Call to initiate starting???
 */
TestTimeline.prototype.start = function () {
  this.started_ = true;

  var parent = this;

  for (var t in this.timeline_) {
    this.timeline_[t].start();
    // FIXME(mithro) this is confusing...
    this.timeline_[t].draw(this.timelinebar, this.endTime_);

    this.timeline_[t].marker.onclick = function(event) {
      parent.setTime(this.millis);
      event.stopPropagation();
    }.bind(this.timeline_[t]);
  }

  this.timelinebar.onclick = function(evt) {
    var setPercent =
      ((evt.clientX - this.offsetLeft) / this.offsetWidth);
    parent.setTime(setPercent * parent.endTime_);
  }.bind(this.timelinebar);
};


TestTimeline.prototype.autorun = function() {
  this.autorun_ = true;
  this.toNextEvent();
};

// Capture the real requestAnimationFrame so we can run in 'real time' mode
// rather than as fast as possible.
var raf = window.requestAnimationFrame;
var raf_t0 = null;
function testharness_raf(ts) {
  if (raf_t0 === null) {
    raf_t0 = ts;
  }

  var t = ts - raf_t0;

  var endTime = testharness_timeline.endTime_;
  // If we have no events paste t=0, endTime is going to be zero. Instead
  // make the test run for 2 minutes.
  if (endTime == 0) {
    endTime = 120e3;
  }

  // Do we still have time to go?
  if (t < endTime) {
    testharness_timeline.setTime(t);
    raf(testharness_raf);

  } else {
    // Have we gone past endTime_? Force the harness to its endTime_.

    testharness_timeline.setTime(testharness_timeline.endTime_);
    // Don't continue to raf
  }

  // FIXME: When reset is called, we need to clear raf_t0
}

function testharness_timeline_setup() {
  testharness_timeline.createGUI(document.getElementsByTagName('body')[0]);
  testharness_timeline.start();
  testharness_timeline.updateGUI();

  // Start running the test on message
  if ('#message' == window.location.hash) {
    window.addEventListener('message', function(evt) {
      switch (evt.data['type']) {
        case 'start':
          if (evt.data['url'] == window.location.href) {
            testharness_timeline.autorun();
          }
          break;
      }
    });
  } else if ('#auto' == window.location.hash) {
    // Run the test as fast as possible, skipping time.

    // Need non-zero timeout to allow chrome to run other code.
    setTimeout(testharness_timeline.autorun.bind(testharness_timeline), 1);

  } else if('#explore' == window.location.hash ||
        window.location.hash.length == 0) {
    raf(testharness_raf);
  } else {
    alert('Unknown start mode.');
  }
}
addEventListener('load', testharness_timeline_setup);

// Capture testharness's test as we are about to screw with it.
var testharness_test = window.test;

function override_at(replacement_at, f, args) {
  var orig_at = window.at;
  window.at = replacement_at;
  f.apply(null, args);
  window.at = orig_at;
}

function timing_test(f, desc) {
  /**
   * at function inside a timing_test function allows testing things at a
   * given time rather then onload.
   * @param {number} seconds Seconds after page load to run the tests.
   * @param {function()} f Closure containing the asserts to be run.
   * @param {string} desc Description
   */
  var at = function(seconds, f, desc_at) {
    assert_true(typeof seconds == 'number', "at's first argument shoud be a number.");
    assert_true(!isNaN(seconds), "at's first argument should be a number not NaN!");
    assert_true(seconds >= 0, "at's first argument should be greater then 0.");
    assert_true(isFinite(seconds), "at's first argument should be finite.");

    assert_true(typeof f == 'function', "at's second argument should be a function.");

    // Deliberately hoist the desc if we where not given one.
    if (typeof desc_at == 'undefined' || desc_at == null || desc_at.length == 0) {
      desc_at = desc;
    }

    // And then provide 'Unnamed' as a default
    if (typeof desc_at == 'undefined' || desc_at == null || desc_at.length == 0) {
      desc_at = 'Unnamed assert';
    }

    var t = async_test(desc_at + ' at t=' + seconds + 's');
    t.f = f;
    window.testharness_timeline.schedule(t, seconds * 1000.0);
  };
  override_at(at, f);
}
window.timing_test = timing_test;

function test_without_at(f, desc) {
   // Make sure calling at inside a test() function is a failure.
  override_at(function() {
    throw {'message': 'Can not use at() inside a test, use a timing_test instead.'};
  }, function() { testharness_test(f, desc); });
}
window.test = test_without_at;

/**
 * at function schedules a to be called at a given point.
 * @param {number} seconds Seconds after page load to run the function.
 * @param {function()} f Function to be called. Called with no arguments
 */
function at(seconds, f) {
  assert_true(typeof seconds == 'number', "at's first argument shoud be a number.");
  assert_true(typeof f == 'function', "at's second argument should be a function.");

  window.testharness_timeline.schedule(f, seconds * 1000.0);
}
window.at = at;

// Expose the extra API
window.testharness_timeline = new TestTimeline();

// Override existing timing functions
window.requestAnimationFrame =
  testharness_timeline.requestAnimationFrame.bind(testharness_timeline);
window.performance.now = null;
window.Date.now = testharness_timeline.now.bind(testharness_timeline);

})();
