/**
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and

 * limitations under the License.
 */
(function() {
"use strict";

function detectFeatures() {
  var style = document.createElement('style');
  style.textContent = '' +
     'dummyRuleForTesting {' +
     'width: calc(0px);' +
     'width: -webkit-calc(0px); }';
  document.head.appendChild(style);
  var transformCandidates = [
      'transform',
      'webkitTransform',
      'msTransform'
  ];
  var transformProperty = transformCandidates.filter(function(property) {
    return property in style.sheet.cssRules[0].style;
  })[0];
  var calcFunction = style.sheet.cssRules[0].style.width.split('(')[0];
  document.head.removeChild(style);
  return {
    transformProperty: transformProperty,
    calcFunction: calcFunction
  };
}

var features = detectFeatures();
var constructorToken = {};

var createObject = function(proto, obj) {
  var newObject = Object.create(proto);
  Object.getOwnPropertyNames(obj).forEach(function(name) {
    Object.defineProperty(newObject, name,
                          Object.getOwnPropertyDescriptor(obj, name));
  });
  return newObject;
};

var abstractMethod = function() {
  throw "Abstract method not implemented.";
};

var IndexSizeError = function(message) {
  Error.call(this);
  this.name = "IndexSizeError";
  this.message = message;
};

IndexSizeError.prototype = Object.create(Error.prototype);

/** @constructor */
var TimingDict = function(timingInput) {
  if (typeof timingInput == 'object') {
    for (var k in timingInput) {
      if (k in TimingDict.prototype) {
        this[k] = timingInput[k];
      }
    }
  } else if (isDefinedAndNotNull(timingInput)) {
    this.iterationDuration = Number(timingInput);
  }
};

TimingDict.prototype = {
  startDelay: 0,
  fillMode: 'forwards',
  iterationStart: 0,
  iterationCount: 1,
  iterationDuration: 'auto',
  activeDuration: 'auto',
  playbackRate: 1,
  direction: 'normal',
  timingFunction: 'linear',
}

/** @constructor */
var Timing = function(token, timingInput, changeHandler) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  this._dict = new TimingDict(timingInput);
  this._changeHandler = changeHandler;
};

Timing.prototype = {
  _timingFunction: function(timedItem) {
    var timingFunction = TimingFunction.createFromString(
        this.timingFunction, timedItem);
    this._timingFunction = function() {
      return timingFunction;
    };
    return timingFunction;
  },
  _invalidateTimingFunction: function() {
    delete this._timingFunction;
  },
  _iterationCount: function() {
    var value = this._dict.iterationCount;
    return value < 0 ? 1 : value;
  },
  _iterationDuration: function() {
    var value = this._dict.iterationDuration;
    return typeof value == 'number' ? value : 'auto';
  },
  _activeDuration: function() {
    var value = this._dict.activeDuration;
    return typeof value == 'number' ? value : 'auto';
  },
  _clone: function() {
    return new Timing(constructorToken, this._dict, this._updateInternalState.bind(this));
  },
};

// Configures an accessor descriptor for use with Object.defineProperty() to
// allow the property to be changed and enumerated, to match __defineGetter__()
// and __defineSetter__().
var configureDescriptor = function(descriptor) {
  descriptor.configurable = true,
  descriptor.enumerable = true;
  return descriptor;
};

Timing._defineProperty = function(prop) {
  Object.defineProperty(Timing.prototype, prop, configureDescriptor({
    get: function() {
      return this._dict[prop];
    },
    set: function(value) {
      if (isDefinedAndNotNull(value)) {
        this._dict[prop] = value;
      } else {
        delete this._dict[prop];
      }
      // FIXME: probably need to implement specialized handling parsing
      // for each property
      if (prop == 'timingFunction') {
        // Cached timing function may be invalid now.
        delete this._timingFunction;
      }
      this._changeHandler();
    }
  }));
};

for (var prop in TimingDict.prototype) {
  Timing._defineProperty(prop);
}

var isDefined = function(val) {
  return typeof val !== 'undefined';
};

var isDefinedAndNotNull = function(val) {
  return isDefined(val) && (val !== null);
};


/** @constructor */
var Timeline = function(token) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  // TODO: This will probably need to change.
  this._startTime = documentTimeZeroAsClockTime;
  if (this._startTime !== undefined) {
    this._startTime /= 1000;
  }
};

Timeline.prototype = {
  get currentTime() {
    if (this._startTime === undefined) {
      this._startTime = documentTimeZeroAsClockTime;
      if (this._startTime === undefined) {
        return null;
      } else {
        this._startTime /= 1000;
      }
    }
    return relativeTime(cachedClockTime(), this._startTime);
  },
  play: function(source) {
    return new Player(constructorToken, source, this);
  },
  getCurrentPlayers: function() {
    return PLAYERS.filter(function(player) {
      return !player._isPastEndOfActiveInterval();
    });
  },
  toTimelineTime: function(otherTime, other) {
    if ((this.currentTime === null) || (other.currentTime === null)) {
      return null;
    }
    else return (otherTime + other._startTime - this._startTime);
  },
  _pauseAnimationsForTesting: function(pauseAt) {
    PLAYERS.forEach(function(player) {
      player.paused = true;
      player.currentTime = pauseAt;
    });
  },
};

// TODO: Remove dead Players from here?
var PLAYERS = [];

/** @constructor */
var Player = function(token, source, timeline) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  this._timeline = timeline;
  this._startTime =
      this.timeline.currentTime === null ? 0 : this.timeline.currentTime;
  this._timeDrift = 0.0;
  this._pauseTime = undefined;
  this._playbackRate = 1.0;
  this._hasTicked = false;

  this.source = source;
  this._checkForHandlers();
  this._lastCurrentTime = undefined;

  PLAYERS.push(this);
  maybeRestartAnimation();
};

Player.prototype = {
  set source(source) {
    enterModifyCurrentAnimationState();
    try {
      if (isDefinedAndNotNull(this.source)) {
        // To prevent infinite recursion.
        var oldTimedItem = this.source;
        this._source = null;
        oldTimedItem._attach(null);
      }
      this._source = source;
      if (isDefinedAndNotNull(this.source)) {
        this.source._attach(this);
        this._update();
        maybeRestartAnimation();
      }
      this._checkForHandlers();
    } finally {
      exitModifyCurrentAnimationState(this._hasTicked);
    }
  },
  get source() {
    return this._source;
  },
  // This is the effective current time.
  set currentTime(currentTime) {
    enterModifyCurrentAnimationState();
    try {
      this._currentTime = currentTime;
    } finally {
      exitModifyCurrentAnimationState(
          this._hasTicked || this.startTime + this._timeDrift <= lastTickTime);
    }
  },
  get currentTime() {
    return this._currentTime === null ? 0 : this._currentTime;
  },
  // This is the current time.
  set _currentTime(currentTime) {
    // This seeks by updating _drift. It does not affect the startTime.
    if (isDefined(this._pauseTime)) {
      this._pauseTime = currentTime;
    } else {
      this._timeDrift = (this.timeline.currentTime - this.startTime) *
          this.playbackRate - currentTime;
    }
    this._update();
    maybeRestartAnimation();
  },
  get _currentTime() {
    if (this.timeline.currentTime === null) {
      return null;
    }
    return isDefined(this._pauseTime) ? this._pauseTime :
        (this.timeline.currentTime - this.startTime) * this.playbackRate -
        this._timeDrift;
  },
  set startTime(startTime) {
    enterModifyCurrentAnimationState();
    try {
      // This seeks by updating _startTime and hence the currentTime. It does not
      // affect _drift.
      this._startTime = startTime;
      this._update();
      maybeRestartAnimation();
    } finally {
      exitModifyCurrentAnimationState(
          this._hasTicked || this.startTime + this._timeDrift <= lastTickTime);
    }
  },
  get startTime() {
    return this._startTime;
  },
  set paused(isPaused) {
    if (isPaused) {
      this._pauseTime = this.currentTime;
    } else if (isDefined(this._pauseTime)) {
      this._timeDrift = (this.timeline.currentTime - this.startTime) *
          this.playbackRate - this._pauseTime;
      this._pauseTime = undefined;
      maybeRestartAnimation();
    }
  },
  get paused() {
    return isDefined(this._pauseTime);
  },
  get timeline() {
    return this._timeline;
  },
  set playbackRate(playbackRate) {
    enterModifyCurrentAnimationState();
    try {
      var cachedCurrentTime = this.currentTime;
      // This will impact currentTime, so perform a compensatory seek.
      this._playbackRate = playbackRate;
      this.currentTime = cachedCurrentTime;
    } finally {
      exitModifyCurrentAnimationState(this._hasTicked);
    }
  },
  get playbackRate() {
    return this._playbackRate;
  },
  _update: function() {
    if (this.source !== null) {
      this.source._updateInheritedTime(this._currentTime);
    }
  },
  _isPastEndOfActiveInterval: function() {
    return this.source === null ||
        this.source._isPastEndOfActiveInterval();
  },
  _isCurrent: function() {
    return this.source && this.source._isCurrent();
  },
  _getLeafItemsInEffect: function(items) {
    if (this.source) {
      this.source._getLeafItemsInEffect(items);
    }
  },
  _isTargetingElement: function(element) {
    return this.source && this.source._isTargetingElement(element);
  },
  _getAnimationsTargetingElement: function(element, animations) {
    if (this.source) {
      this.source._getAnimationsTargetingElement(element, animations);
    }
  },
  _handlerAdded: function() {
    this._needsHandlerPass = true;
  },
  _checkForHandlers: function() {
    this._needsHandlerPass = this.source !== null && this.source._hasHandler();
  },
  _generateEvents: function() {
    if (!isDefinedAndNotNull(this._lastCurrentTime)) {
      this._lastCurrentTime = this._startTime;
    }

    if (this._needsHandlerPass) {
      var timeDelta = this._currentTime - this._lastCurrentTime;
      if (timeDelta > 0) {
        this.source._generateEvents(this._lastCurrentTime, this._currentTime, this.timeline.currentTime, 1);
      }
    }

    this._lastCurrentTime = this._currentTime;
  },
};


/** @constructor */
var TimedItem = function(token, timingInput) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  this.specified = new Timing(constructorToken, timingInput, this._specifiedTimingModified.bind(this));
  this._inheritedTime = null;
  this.currentIteration = null;
  this._iterationTime = null;
  this._animationTime = null;
  this._startTime = 0.0;
  this._player = null;
  this._parent = null;
  this._updateInternalState();
};

TimedItem.prototype = {
  // TODO: It would be good to avoid the need for this. We would need to modify
  // call sites to instead rely on a call from the parent.
  get _effectiveParentTime() {
    return
        this.parent !== null && this.parent._iterationTime !== null ?
        this.parent._iterationTime : 0;
  },
  get localTime() {
    return this._inheritedTime === null ?
        null : this._inheritedTime - this._startTime;
  },
  get startTime() {
    return this._startTime;
  },
  get iterationDuration() {
    var result = this.specified._iterationDuration();
    if (result == 'auto')
        result = this._intrinsicDuration();
    return result;
  },
  get activeDuration() {
    var result = this.specified._activeDuration();
    if (result == 'auto') {
      var repeatedDuration = this.iterationDuration * this.specified._iterationCount();
      result = repeatedDuration / Math.abs(this.specified.playbackRate);
    }
    return result;
  },
  get endTime() {
    return this._startTime + this.activeDuration + this.specified.startDelay;
  },
  get parent() {
    return this._parent;
  },
  _attach: function(player) {
    // Remove ourselves from our parent, if we have one. This also removes any
    // exsisting player.
    this._reparent(null);
    this._player = player;
  },
  // Takes care of updating the outgoing parent. This is called with a non-null
  // parent only from TimingGroup.splice(), which takes care of calling
  // TimingGroup._childrenStateModified() for the new parent.
  _reparent: function(parent) {
    if (parent === this) {
      throw new Error('parent can not be set to self!');
    }
    enterModifyCurrentAnimationState();
    try {
      if (this._player !== null) {
        this._player.source = null;
        this._player = null;
      }
      if (this.parent !== null) {
        this.remove();
      }
      this._parent = parent;
      // In the case of a SeqGroup parent, _startTime will be updated by
      // TimingGroup.splice().
      if (this.parent === null || this.parent.type !== 'seq') {
        this._startTime =
            this._stashedStartTime === undefined ? 0.0 : this._stashedStartTime;
        this._stashedStartTime = undefined;
      }
      // In the case of the parent being non-null, _childrenStateModified() will
      // call this via _updateChildInheritedTimes().
      // TODO: Consider optimising this case by skipping this call.
      this._updateTimeMarkers();
    } finally {
      exitModifyCurrentAnimationState(Boolean(this.player) && this.player._hasTicked);
    }
  },
  _intrinsicDuration: function() {
    return 0.0;
  },
  _updateInternalState: function() {
    if (this.parent) {
      this.parent._childrenStateModified();
    }
    this._updateTimeMarkers();
  },
  _specifiedTimingModified: function() {
    enterModifyCurrentAnimationState();
    try {
      this._updateInternalState();
    } finally {
      exitModifyCurrentAnimationState(Boolean(this.player) && this.player._hasTicked);
    }
  },
  // We push time down to children. We could instead have children pull from
  // above, but this is tricky because a TimedItem may use either a parent
  // TimedItem or an Player. This requires either logic in
  // TimedItem, or for TimedItem and Player to implement Timeline
  // (or an equivalent), both of which are ugly.
  _updateInheritedTime: function(inheritedTime) {
    this._inheritedTime = inheritedTime;
    this._updateTimeMarkers();
  },
  _updateAnimationTime: function() {
    if (this.localTime < this.specified.startDelay) {
      if (this.specified.fillMode === 'backwards' ||
          this.specified.fillMode === 'both') {
        this._animationTime = 0;
      } else {
        this._animationTime = null;
      }
    } else if (this.localTime <
        this.specified.startDelay + this.activeDuration) {
      this._animationTime = this.localTime - this.specified.startDelay;
    } else {
      if (this.specified.fillMode === 'forwards' ||
          this.specified.fillMode === 'both') {
        this._animationTime = this.activeDuration;
      } else {
        this._animationTime = null;
      }
    }
  },
  _updateIterationParamsZeroDuration: function() {
    this._iterationTime = 0;
    var isAtEndOfIterations = this.specified._iterationCount() != 0 &&
        this.localTime >= this.specified.startDelay;
    this.currentIteration = isAtEndOfIterations ?
       this._floorWithOpenClosedRange(this.specified.iterationStart +
           this.specified._iterationCount(), 1.0) :
       this._floorWithClosedOpenRange(this.specified.iterationStart, 1.0);
    // Equivalent to unscaledIterationTime below.
    var unscaledFraction = isAtEndOfIterations ?
        this._modulusWithOpenClosedRange(this.specified.iterationStart +
            this.specified._iterationCount(), 1.0) :
        this._modulusWithClosedOpenRange(this.specified.iterationStart, 1.0);
    var timingFunction = this.specified._timingFunction(this);
    this._timeFraction = this._isCurrentDirectionForwards() ?
            unscaledFraction :
            1.0 - unscaledFraction;
    console.assert(this._timeFraction >= 0.0 && this._timeFraction <= 1.0,
        'Time fraction should be in the range [0, 1]');
    if (timingFunction) {
      this._timeFraction = timingFunction.scaleTime(this._timeFraction);
    }
  },
  _getAdjustedAnimationTime: function(animationTime) {
    var startOffset =
        multiplyZeroGivesZero(this.specified.iterationStart, this.iterationDuration);
    return (this.specified.playbackRate < 0 ?
        (animationTime - this.activeDuration) : animationTime) *
        this.specified.playbackRate + startOffset;
  },
  _scaleIterationTime: function(unscaledIterationTime) {
    return this._isCurrentDirectionForwards() ?
        unscaledIterationTime :
        this.iterationDuration - unscaledIterationTime;
  },
  _updateIterationParams: function() {
    var adjustedAnimationTime =
        this._getAdjustedAnimationTime(this._animationTime);
    var repeatedDuration = this.iterationDuration * this.specified._iterationCount();
    var startOffset = this.specified.iterationStart * this.iterationDuration;
    var isAtEndOfIterations = (this.specified._iterationCount() != 0) &&
        (adjustedAnimationTime - startOffset == repeatedDuration);
    this.currentIteration = isAtEndOfIterations ?
        this._floorWithOpenClosedRange(
            adjustedAnimationTime, this.iterationDuration) :
        this._floorWithClosedOpenRange(
            adjustedAnimationTime, this.iterationDuration);
    var unscaledIterationTime = isAtEndOfIterations ?
        this._modulusWithOpenClosedRange(
            adjustedAnimationTime, this.iterationDuration) :
        this._modulusWithClosedOpenRange(
            adjustedAnimationTime, this.iterationDuration);
    this._iterationTime = this._scaleIterationTime(unscaledIterationTime);
    this._timeFraction = this._iterationTime / this.iterationDuration;
    console.assert(this._timeFraction >= 0.0 && this._timeFraction <= 1.0,
        'Time fraction should be in the range [0, 1], got ' +
        this._timeFraction + ' ' + this._iterationTime + ' ' +
        this.iterationDuration + ' ' + isAtEndOfIterations + ' ' +
        unscaledIterationTime);
    var timingFunction = this.specified._timingFunction(this);
    if (timingFunction) {
      this._timeFraction = timingFunction.scaleTime(this._timeFraction);
    }
    this._iterationTime = this._timeFraction * this.iterationDuration;
  },
  _updateTimeMarkers: function() {
    if (this.localTime === null) {
      this._animationTime = null;
      this._iterationTime = null;
      this.currentIteration = null;
      this._timeFraction = null;
      return false;
    }
    this._updateAnimationTime();
    if (this._animationTime === null) {
      this._iterationTime = null;
      this.currentIteration = null;
      this._timeFraction = null;
    } else if (this.iterationDuration == 0) {
      this._updateIterationParamsZeroDuration();
    } else {
      this._updateIterationParams();
    }
    maybeRestartAnimation();
  },
  _floorWithClosedOpenRange: function(x, range) {
    return Math.floor(x / range);
  },
  _floorWithOpenClosedRange: function(x, range) {
    return Math.ceil(x / range) - 1;
  },
  _modulusWithClosedOpenRange: function(x, range) {
    console.assert(range > 0, 'Range must be strictly positive');
    var modulus = x % range;
    var result = modulus < 0 ? modulus + range : modulus;
    console.assert(result >= 0.0 && result < range,
        'Result should be in the range [0, range)');
    return result;
  },
  _modulusWithOpenClosedRange: function(x, range) {
    var modulus = this._modulusWithClosedOpenRange(x, range);
    var result = modulus == 0 ? range : modulus;
    console.assert(result > 0.0 && result <= range,
        'Result should be in the range (0, range]');
    return result;
  },
  _isCurrentDirectionForwards: function() {
    if (this.specified.direction == 'normal') {
      return true;
    }
    if (this.specified.direction == 'reverse') {
      return false;
    }
    var d = this.currentIteration;
    if (this.specified.direction == 'alternate-reverse') {
      d += 1;
    }
    // TODO: 6.13.3 step 3. wtf?
    return d % 2 == 0;
  },
  clone: abstractMethod,
  before: function() {
    var newItems = [];
    for (var i = 0; i < arguments.length; i++) {
      newItems.push(arguments[i]);
    }
    this.parent._splice(this.parent.indexOf(this), 0, newItems);
  },
  after: function() {
    var newItems = [];
    for (var i = 0; i < arguments.length; i++) {
      newItems.push(arguments[i]);
    }
    this.parent._splice(this.parent.indexOf(this) + 1, 0, newItems);
  },
  replace: function() {
    var newItems = [];
    for (var i = 0; i < arguments.length; i++) {
      newItems.push(arguments[i]);
    }
    this.parent._splice(this.parent.indexOf(this), 1, newItems);
  },
  remove: function() {
    this.parent._splice(this.parent.indexOf(this), 1);
  },
  // Gets the leaf TimedItems currently in effect. Note that this is a superset
  // of the leaf TimedItems in their active interval, as a TimedItem can have an
  // effect outside its active interval due to fill.
  _getLeafItemsInEffect: function(items) {
    if (this._timeFraction !== null) {
      this._getLeafItemsInEffectImpl(items);
    }
  },
  _getLeafItemsInEffectImpl: abstractMethod,
  _isPastEndOfActiveInterval: function() {
    return this._inheritedTime > this.endTime;
  },
  get player() {
    return this.parent === null ?
        this._player : this.parent.player;
  },
  _isCurrent: function() {
    return !this._isPastEndOfActiveInterval() ||
           (this.parent !== null && this.parent._isCurrent());
  },
  _isTargetingElement: abstractMethod,
  _getAnimationsTargetingElement: abstractMethod,
  _netEffectivePlaybackRate: function() {
    var effectivePlaybackRate = this._isCurrentDirectionForwards() ?
        this.specified.playbackRate : -this.specified.playbackRate;
    return this.parent === null ? effectivePlaybackRate :
        effectivePlaybackRate * this.parent._netEffectivePlaybackRate();
  },
  set onstart(fun) {
    this._startHandler = fun;
    this._newHandler(fun);
  },
  get onstart() {
    return this._startHandler;
  },
  set oniteration(fun) {
    this._iterationHandler = fun;
    this._newHandler(fun);
  },
  get oniteration() {
    return this._iterationHandler;
  },
  set onend(fun) {
    this._endHandler = fun;
    this._newHandler(fun);
  },
  get onend() {
    return this._endHandler;
  },
  set oncancel(fun) {
    this._cancelHandler = fun;
    this._newHandler(fun);
  },
  get oncancel() {
    return this._cancelHander;
  },
  _newHandler: function(fun) {
    if (isDefinedAndNotNull(fun)) {
      if (this.player) {
        this.player._handlerAdded();
      }
    } else {
      if (this.player) {
        this.player._checkForHandlers();
      }
    }
  },
  _hasHandler: function() {
    return isDefinedAndNotNull(this._startHandler) ||
      isDefinedAndNotNull(this._iterationHandler) ||
      isDefinedAndNotNull(this._endHandler) ||
      isDefinedAndNotNull(this._cancelHandler);
  },
  _generateChildEventsForRange: function() { },
  _toSubRanges: function(fromTime, toTime, iterationTimes) {
    if (fromTime > toTime) {
      var revRanges = this._toSubRanges(toTime, fromTime, iterationTimes);
      revRanges.ranges.forEach(function(a) { a.reverse(); })
      revRanges.ranges.reverse();
      revRanges.start = iterationTimes.length - revRanges.start - 1;
      revRanges.delta = -1;
      return revRanges;
    }
    var skipped = 0;
    // TODO: this should be calculatable. This would be more efficient
    // than searching through the list.
    while (iterationTimes[skipped] < fromTime) {
      skipped++;
    }
    var currentStart = fromTime;
    var ranges = [];
    for (var i = skipped; i < iterationTimes.length; i++) {
      if (iterationTimes[i] < toTime) {
        ranges.push([currentStart, iterationTimes[i]]);
        currentStart = iterationTimes[i];
      } else {
        ranges.push([currentStart, toTime]);
        return {start: skipped, delta: 1, ranges: ranges};
      }
    }
    ranges.push([currentStart, toTime]);
    return {start: skipped, delta: 1, ranges: ranges};
  },
  _generateEvents: function(fromTime, toTime, globalTime, deltaScale) {
    function toGlobal(time) {
      return (globalTime - (toTime - (time / deltaScale)));
    }
    var localScale = this.specified.playbackRate;
    var firstIteration = Math.floor(this.specified.iterationStart);
    var lastIteration = Math.floor(this.specified.iterationStart +
        this.specified.iterationCount);
    if (lastIteration == this.specified.iterationStart + 
      this.specified.iterationCount) {
        lastIteration -= 1;
    }
    var startTime = this.startTime + this.specified.startDelay;

    if (isDefinedAndNotNull(this.onstart)) {
      // Did we pass the start of this animation in the forward direction?
      if (fromTime <= startTime && toTime > startTime) {
        this.onstart(new TimingEvent(constructorToken, this, 'start',
            this.specified.startDelay, toGlobal(startTime), firstIteration));
      // Did we pass the end of this animation in the reverse direction?
      } else if (fromTime > this.endTime && toTime <= this.endTime) {
        this.onstart(new TimingEvent(constructorToken, this, 'start',
            this.endTime - this.startTime, toGlobal(this.endTime),
            lastIteration));
      }
    }

    // Calculate a list of uneased iteration times.
    var iterationTimes = [];
    for (var i = firstIteration + 1; i <= lastIteration; i++) {
      iterationTimes.push(i - this.specified.iterationStart);
    }
    iterationTimes = iterationTimes.map(function(i) {
      return i * this.iterationDuration / this.specified.playbackRate + startTime;
    }.bind(this));

    // Determine the impacted subranges.
    var clippedFromTime;
    var clippedToTime;
    if (fromTime < toTime) {
      clippedFromTime = Math.max(fromTime, startTime);
      clippedToTime = Math.min(toTime, this.endTime);
    } else {
      clippedFromTime = Math.min(fromTime, this.endTime);
      clippedToTime = Math.max(toTime, startTime);
    }
    var subranges = this._toSubRanges(clippedFromTime, clippedToTime,
      iterationTimes);
    for (var i = 0; i < subranges.ranges.length; i++) {
      var currentIter = subranges.start + i * subranges.delta;
      if (isDefinedAndNotNull(this.oniteration) && i > 0) {
        var iterTime = subranges.ranges[i][0];
        this.oniteration(new TimingEvent(constructorToken, this, 'iteration',
            iterTime - this.startTime, toGlobal(iterTime), currentIter));
      }

      var iterFraction;
      if (subranges.delta > 0) {
        iterFraction = this.specified.iterationStart % 1;
      } else {
        iterFraction = 1 - 
            (this.specified.iterationStart + this.specified.iterationCount) % 1;
      }
      this._generateChildEventsForRange(
          subranges.ranges[i][0], subranges.ranges[i][1],
          fromTime, toTime, currentIter - iterFraction,
          globalTime, deltaScale * this.specified.playbackRate);
    }

    if (isDefinedAndNotNull(this.onend)) {
      // Did we pass the end of this animation in the forward direction?
      if (fromTime < this.endTime && toTime >= this.endTime) {
        this.onend(new TimingEvent(constructorToken, this, 'end',
            this.endTime - this.startTime, toGlobal(this.endTime),
            lastIteration));
      // Did we pass the start of this animation in the reverse direction?
      } else if (fromTime >= startTime && toTime < startTime) {
        this.onend(new TimingEvent(constructorToken, this, 'end',
            this.specified.startDelay, toGlobal(startTime), firstIteration));
      }
    }
  },
};

var TimingEvent = function(token, target, type, localTime, timelineTime, iterationIndex, seeked) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  this.target = target;
  this.type = type;
  this.cancelBubble = false;
  this.cancelable = false;
  this.defaultPrevented = false;
  this.eventPhase = 0;
  this.returnValue = true;
  this.localTime = localTime;
  this.timelineTime = timelineTime;
  this.iterationIndex = iterationIndex;
  this.seeked = seeked ? true : false;
}

TimingEvent.prototype = Object.create(Event.prototype);

var isCustomAnimationEffect = function(animationEffect) {
  // TODO: How does WebIDL actually differentiate different callback interfaces?
  return isDefinedAndNotNull(animationEffect) &&
      typeof animationEffect === "object" &&
      animationEffect.hasOwnProperty("sample") &&
      typeof animationEffect.sample === "function";
};

var interpretAnimationEffect = function(animationEffect) {
  if (animationEffect instanceof AnimationEffect ||
      isCustomAnimationEffect(animationEffect)) {
    return animationEffect;
  } else if (isDefinedAndNotNull(animationEffect) &&
      typeof animationEffect === 'object') {
    // The spec requires animationEffect to be an instance of
    // OneOrMoreKeyframes, but this type is just a dictionary or a list of
    // dictionaries, so the best we can do is test for an object.
    return new KeyframeAnimationEffect(animationEffect);
  }
  return null;
};

var cloneAnimationEffect = function(animationEffect) {
  if (animationEffect instanceof AnimationEffect) {
    return animationEffect.clone();
  } else if (isCustomAnimationEffect(animationEffect)) {
    if (typeof animationEffect.clone === "function") {
      return animationEffect.clone();
    } else {
      return animationEffect;
    }
  } else {
    return null;
  }
};

/** @constructor */
var Animation = function(target, animationEffect, timingInput) {
  enterModifyCurrentAnimationState();
  try {
    TimedItem.call(this, constructorToken, timingInput);
    this.effect = interpretAnimationEffect(animationEffect);
    this._target = target;
  } finally {
    exitModifyCurrentAnimationState(false);
  }
};

Animation.prototype = createObject(TimedItem.prototype, {
  _sample: function() {
    if (isDefinedAndNotNull(this.effect) &&
        !(this.target instanceof PseudoElementReference)) {
      var sampleMethod = isCustomAnimationEffect(this.effect) ?
          this.effect.sample : this.effect._sample;
      sampleMethod.apply(this.effect, [this._timeFraction,
          this.currentIteration, this.target, this.underlyingValue]);
    }
  },
  _getLeafItemsInEffectImpl: function(items) {
    items.push(this);
  },
  _isTargetingElement: function(element) {
    return element === this.target;
  },
  _getAnimationsTargetingElement: function(element, animations) {
    if (this._isTargetingElement(element)) {
      animations.push(this);
    }
  },
  get target() {
    return this._target;
  },
  set effect(effect) {
    enterModifyCurrentAnimationState();
    try {
      this._effect = effect;
      this.specified._invalidateTimingFunction();
    } finally {
      exitModifyCurrentAnimationState(Boolean(this.player) && this.player._hasTicked);
    }
  },
  get effect() {
    return this._effect;
  },
  clone: function() {
    return new Animation(this.target,
        cloneAnimationEffect(this.effect), this.specified._dict);
  },
  toString: function() {
    var effectString = '<none>';
    if (this.effect instanceof AnimationEffect) {
      effectString = this.effect.toString();
    } else if (isCustomAnimationEffect(this.effect)) {
      effectString = 'Custom effect';
    }
    return 'Animation ' + this.startTime + '-' + this.endTime + ' (' +
        this.localTime + ') ' + effectString;
  },
});

function throwNewHierarchyRequestError() {
  var element = document.createElement('span');
  element.appendChild(element);
}

/** @constructor */
var TimedItemList = function(token, children) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  this._children = children;
  this._getters = 0;
  this._ensureGetters();
};

TimedItemList.prototype = {
  get length() {
    return this._children.length;
  },
  _ensureGetters: function() {
    while (this._getters < this._children.length) {
      this._ensureGetter(this._getters++);
    }
  },
  _ensureGetter: function(i) {
    Object.defineProperty(this, i, {
      get: function() {
        return this._children[i];
      }
    });
  }
};

/** @constructor */
var TimingGroup = function(token, type, children, timing) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  // Take a copy of the children array, as it could be modified as a side-effect
  // of creating this object. See
  // https://github.com/web-animations/web-animations-js/issues/65 for details.
  var childrenCopy = (children && Array.isArray(children)) ?
      children.slice() : [];
  // used by TimedItem via _intrinsicDuration(), so needs to be set before
  // initializing super.
  this.type = type || 'par';
  this._children = [];
  this._cachedTimedItemList = null;
  TimedItem.call(this, constructorToken, timing);
  // We add children after setting the parent. This means that if an ancestor
  // (including the parent) is specified as a child, it will be removed from our
  // ancestors and used as a child,
  this.append.apply(this, childrenCopy);
};

TimingGroup.prototype = createObject(TimedItem.prototype, {
  _childrenStateModified: function() {
    // See _updateChildStartTimes().
    this._isInChildrenStateModified = true;
    if (this._cachedTimedItemList) {
      this._cachedTimedItemList._ensureGetters();
    }

    // We need to walk up and down the tree to re-layout. endTime and the
    // various iterationDurations (which are all calculated lazily) are the only
    // properties of a TimedItem which can affect the layout of its ancestors.
    // So it should be sufficient to simply update start times and time markers
    // on the way down.

    // This calls up to our parent, then calls _updateTimeMarkers().
    this._updateInternalState();
    this._updateChildInheritedTimes();

    // Update child start times before walking down.
    this._updateChildStartTimes();

    if (this.player) {
      this.player._checkForHandlers();
    }

    this._isInChildrenStateModified = false;
  },
  _updateInheritedTime: function(inheritedTime) {
    this._inheritedTime = inheritedTime;
    this._updateTimeMarkers();
    this._updateChildInheritedTimes();
  },
  _updateChildInheritedTimes: function() {
    for (var i = 0; i < this._children.length; i++) {
      var child = this._children[i];
      child._updateInheritedTime(this._iterationTime);
    }
  },
  _updateChildStartTimes: function() {
    if (this.type == 'seq') {
      var cumulativeStartTime = 0;
      for (var i = 0; i < this._children.length; i++) {
        var child = this._children[i];
        if (child._stashedStartTime === undefined) {
          child._stashedStartTime = child._startTime;
        }
        child._startTime = cumulativeStartTime;
        // Avoid updating the child's inherited time and time markers if this is
        // about to be done in the down phase of _childrenStateModified().
        if (!child._isInChildrenStateModified) {
          // This calls _updateTimeMarkers() on the child.
          child._updateInheritedTime(this._iterationTime);
        }
        cumulativeStartTime += Math.max(0, child.specified.startDelay +
            child.activeDuration);
      }
    }
  },
  get children() {
    if (!this._cachedTimedItemList) {
      this._cachedTimedItemList = new TimedItemList(constructorToken, this._children);
    }
    return this._cachedTimedItemList;
  },
  get firstChild() {
    return this._children[0];
  },
  get lastChild() {
    return this._children[this.children.length - 1];
  },
  _intrinsicDuration: function() {
    if (this.type == 'par') {
      var dur = Math.max.apply(undefined, this._children.map(function(a) {
        return a.endTime;
      }));
      return Math.max(0, dur);
    } else if (this.type == 'seq') {
      var result = 0;
      this._children.forEach(function(a) {
        result += a.activeDuration + a.specified.startDelay;
      });
      return result;
    } else {
      throw 'Unsupported type ' + this.type;
    }
  },
  _getLeafItemsInEffectImpl: function(items) {
    for (var i = 0; i < this._children.length; i++) {
      this._children[i]._getLeafItemsInEffect(items);
    }
  },
  clone: function() {
    var children = [];
    this._children.forEach(function(child) {
      children.push(child.clone());
    });
    return this.type === "par" ?
        new ParGroup(children, this.specified._dict):
        new SeqGroup(children, this.specified._dict);
  },
  clear: function() {
    this._splice(0, this._children.length);
  },
  append: function() {
    var newItems = [];
    for (var i = 0; i < arguments.length; i++) {
      newItems.push(arguments[i]);
    }
    this._splice(this._children.length, 0, newItems);
  },
  prepend: function() {
    var newItems = [];
    for (var i = 0; i < arguments.length; i++) {
      newItems.push(arguments[i]);
    }
    this._splice(0, 0, newItems);
  },
  _addInternal: function(child) {
    this._children.push(child);
    this._childrenStateModified();
  },
  indexOf: function(item) {
    return this._children.indexOf(item);
  },
  _splice: function(start, deleteCount, newItems) {
    enterModifyCurrentAnimationState();
    try {
      var args = arguments;
      if (args.length == 3) {
        args = [start, deleteCount].concat(newItems);
      }
      for (var i = 2; i < args.length; i++) {
        var newChild = args[i];
        if (this._isInclusiveAncestor(newChild)) {
          throwNewHierarchyRequestError();
        }
        newChild._reparent(this);
      }
      var result = Array.prototype['splice'].apply(this._children, args);
      for (var i = 0; i < result.length; i++) {
        result[i]._parent = null;
      }
      this._childrenStateModified();
      return result;
    } finally {
      exitModifyCurrentAnimationState(Boolean(this.player) && this.player._hasTicked);
    }
  },
  _isInclusiveAncestor: function(item) {
    for (var ancestor = this; ancestor != null;
      ancestor = ancestor.parent) {
      if (ancestor === item) {
        return true;
      }
    }
    return false;
  },
  _isTargetingElement: function(element) {
    return this._children.some(function(child) {
      return child._isTargetingElement(element);
    });
  },
  _getAnimationsTargetingElement: function(element, animations) {
    this._children.map(function(child) {
      return child._getAnimationsTargetingElement(element, animations);
    });
  },
  toString: function() {
    return this.type + ' ' + this.startTime + '-' + this.endTime + ' (' +
        this.localTime + ') ' + ' [' +
        this._children.map(function(a) { return a.toString(); }) + ']'
  },
  _hasHandler: function() {
    return TimedItem.prototype._hasHandler.call(this) ||
      (this._children.length > 0 &&
        this._children.reduce(function(a, b) { return a || b._hasHandler() },
          false));
  },
  _generateChildEventsForRange: function(localStart, localEnd, rangeStart,
      rangeEnd, iteration, globalTime, deltaScale) {
    var start;
    var end;

    if (localEnd - localStart > 0) {
      start = Math.max(rangeStart, localStart);
      end = Math.min(rangeEnd, localEnd);
      if (start >= end) {
        return;
      }
    } else {
      start = Math.min(rangeStart, localStart);
      end = Math.max(rangeEnd, localEnd);
      if (start <= end) {
        return;
      }
    }

    var endDelta = rangeEnd - end;
    start -= iteration * this.iterationDuration / deltaScale;
    end -= iteration * this.iterationDuration / deltaScale;

    for (var i = 0; i < this._children.length; i++) {
      this._children[i]._generateEvents(start, end, globalTime - endDelta, deltaScale);
    }
  },
});

/** @constructor */
var  ParGroup = function(children, timing, parent) {
  TimingGroup.call(this, constructorToken, 'par', children, timing, parent);
};

ParGroup.prototype = Object.create(TimingGroup.prototype);

/** @constructor */
var SeqGroup = function(children, timing, parent) {
  TimingGroup.call(this, constructorToken, 'seq', children, timing, parent);
};

SeqGroup.prototype = Object.create(TimingGroup.prototype);

/** @constructor */
var PseudoElementReference = function(element, pseudoElement) {
    this.element = element;
    this.pseudoElement = pseudoElement;
    console.warn("PseudoElementReference is not supported.");
};

/** @constructor */
var MediaReference = function(mediaElement, timing, parent, delta) {
  TimedItem.call(this, constructorToken, timing, parent);
  this._media = mediaElement;

  // We can never be sure when _updateInheritedTime() is going to be called
  // next, due to skipped frames or the player being seeked. Plus the media
  // element's currentTime may drift from our iterationTime. So if a media
  // element has loop set, we can't be sure that we'll stop it before it wraps.
  // For this reason, we simply disable looping.
  // TODO: Maybe we should let it loop if our iterationDuration exceeds it's
  // length?
  this._media.loop = false;

  // If the media element has a media controller, we detach it. This mirrors the
  // behaviour when re-parenting a TimedItem, or attaching one to a Player.
  // TODO: It would be neater to assign to MediaElement.controller, but this was
  // broken in Chrome until recently. See crbug.com/226270.
  this._media.mediaGroup = '';

  this._delta = delta;
};

MediaReference.prototype = createObject(TimedItem.prototype, {
  _intrinsicDuration: function() {
    // TODO: This should probably default to zero. But doing so means that as
    // soon as our inheritedTime is zero, the polyfill deems the animation to be
    // done and stops ticking, so we don't get any further calls to
    // _updateInheritedTime(). One way around this would be to modify
    // TimedItem._isPastEndOfActiveInterval() to recurse down the tree, then we
    // could override it here.
    return isNaN(this._media.duration) ?
        Infinity : this._media.duration / this._media.defaultPlaybackRate;
  },
  _unscaledMediaCurrentTime: function() {
    return this._media.currentTime / this._media.defaultPlaybackRate;
  },
  _getLeafItemsInEffectImpl: function(items) {
    items.push(this);
  },
  _ensurePlaying: function() {
    // The media element is paused when created.
    if (this._media.paused) {
      this._media.play();
    }
  },
  _ensurePaused: function() {
    if (!this._media.paused) {
      this._media.pause();
    }
  },
  _isSeekableUnscaledTime: function(time) {
    var seekTime = time * this._media.defaultPlaybackRate;
    var ranges = this._media.seekable;
    for (var i = 0; i < ranges.length; i++) {
      if (seekTime >= ranges.start(i) && seekTime <= ranges.end(i)) {
        return true;
      }
    }
    return false;
  },
  // Note that a media element's timeline may not start at zero, although its
  // duration is always the timeline time at the end point. This means that an
  // element's duration isn't always it's length and not all values of the
  // timline are seekable. Furthermore, some types of media further limit the
  // range of seekable timeline times. For this reason, we always map an
  // iteration to the range [0, duration] and simply seek to the nearest
  // seekable time.
  _ensureIsAtUnscaledTime: function(time) {
    if (this._unscaledMediaCurrentTime() !== time) {
      this._media.currentTime = time * this._media.defaultPlaybackRate;
    }
  },
  // This is called by the polyfill on each tick when our Player's tree is
  // active.
  _updateInheritedTime: function(inheritedTime) {
    this._inheritedTime = inheritedTime;
    this._updateTimeMarkers();

    // The polyfill uses a sampling model whereby time values are propagated
    // down the tree at each sample. However, for the media item, we need to use
    // play() and pause().

    // Handle the case of being outside our effect interval.
    if (this._iterationTime === null) {
      this._ensureIsAtUnscaledTime(0);
      this._ensurePaused();
      return;
    }

    if (this._iterationTime >= this._intrinsicDuration()) {
      // Our iteration time exceeds the media element's duration, so just make
      // sure the media element is at the end. It will stop automatically, but
      // that could take some time if the seek below is significant, so force
      // it.
      this._ensureIsAtUnscaledTime(this._intrinsicDuration());
      this._ensurePaused();
      return;
    }

    var finalIteration = this._floorWithOpenClosedRange(
        this.specified.iterationStart + this.specified._iterationCount(), 1.0);
    var endTimeFraction = this._modulusWithOpenClosedRange(
        this.specified.iterationStart + this.specified._iterationCount(), 1.0);
    if (this.currentIteration === finalIteration &&
        this._timeFraction === endTimeFraction &&
        this._intrinsicDuration() >= this.iterationDuration) {
      // We have reached the end of our final iteration, but the media element
      // is not done.
      this._ensureIsAtUnscaledTime(this.iterationDuration * endTimeFraction);
      this._ensurePaused();
      return;
    }

    // Set the appropriate playback rate.
    var playbackRate =
        this._media.defaultPlaybackRate * this._netEffectivePlaybackRate();
    if (this._media.playbackRate !== playbackRate) {
      this._media.playbackRate = playbackRate;
    }

    // Set the appropriate play/pause state. Note that we may not be able to
    // seek to the desired time. In this case, the media element's seek
    // algorithm repositions the seek to the nearest seekable time. This is OK,
    // but in this case, we don't want to play the media element, as it prevents
    // us from synchronising properly.
    if (this.player.paused ||
        !this._isSeekableUnscaledTime(this._iterationTime)) {
      this._ensurePaused();
    } else {
      this._ensurePlaying();
    }

    // Seek if required. This could be due to our Player being seeked, or video
    // slippage. We need to handle the fact that the video may not play at
    // exactly the right speed. There's also a variable delay when the video is
    // first played.
    // TODO: What's the right value for this delta?
    var delta = isDefinedAndNotNull(this._delta) ? this._delta :
        0.2 * Math.abs(this._media.playbackRate);
    if (Math.abs(this._iterationTime - this._unscaledMediaCurrentTime()) >
        delta) {
      this._ensureIsAtUnscaledTime(this._iterationTime);
    }
  },
  _isTargetingElement: function(element) {
    return this._media === element;
  },
  _getAnimationsTargetingElement: function(element, animations) { },
  _attach: function(player) {
    this._ensurePaused();
    TimedItem.prototype._attach.call(this, player);
  },
});


/** @constructor */
var AnimationEffect = function(token, accumulate) {
  if (token !== constructorToken) {
    throw new TypeError('Illegal constructor');
  }
  enterModifyCurrentAnimationState();
  try {
    this.accumulate = accumulate;
  } finally {
    exitModifyCurrentAnimationState(false);
  }
};

AnimationEffect.prototype = {
  get accumulate() {
    return this._accumulate;
  },
  set accumulate(value) {
    enterModifyCurrentAnimationState();
    try {
      // Use the default value if an invalid string is specified.
      this._accumulate = value === 'sum' ? 'sum' : 'none';
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  _sample: abstractMethod,
  clone: abstractMethod,
  toString: abstractMethod,
};

var clamp = function(x, min, max) {
  return Math.max(Math.min(x, max), min);
}

/** @constructor */
var PathAnimationEffect = function(path, autoRotate, angle, composite,
    accumulate) {
  enterModifyCurrentAnimationState();
  try {
    AnimationEffect.call(this, constructorToken, accumulate);

    // Use the default value if an invalid string is specified.
    this.composite = composite;

    // TODO: path argument is not in the spec -- seems useful since
    // SVGPathSegList doesn't have a constructor.
    this.autoRotate = isDefined(autoRotate) ? autoRotate : 'none';
    this.angle = isDefined(angle) ? angle : 0;
    this._path = document.createElementNS('http://www.w3.org/2000/svg','path');
    if (path instanceof SVGPathSegList) {
      this.segments = path;
    } else {
      var tempPath = document.createElementNS(
          'http://www.w3.org/2000/svg','path');
      tempPath.setAttribute('d', String(path));
      this.segments = tempPath.pathSegList;
    }
  } finally {
    exitModifyCurrentAnimationState(false);
  }
};

PathAnimationEffect.prototype = createObject(AnimationEffect.prototype, {
  get composite() {
    return this._composite;
  },
  set composite(value) {
    enterModifyCurrentAnimationState();
    try {
      // Use the default value if an invalid string is specified.
      this._composite = value === 'add' ? 'add' : 'replace';
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  _sample: function(timeFraction, currentIteration, target) {
    // TODO: Handle accumulation.
    var lengthAtTimeFraction = this._lengthAtTimeFraction(timeFraction);
    var point = this._path.getPointAtLength(lengthAtTimeFraction);
    var x = point.x - target.offsetWidth / 2;
    var y = point.y - target.offsetHeight / 2;
    // TODO: calc(point.x - 50%) doesn't work?
    var value = [{t: 'translate', d: [{px: x}, {px: y}]}];
    var angle = this.angle;
    if (this._autoRotate == 'auto-rotate') {
      // Super hacks
      var lastPoint = this._path.getPointAtLength(lengthAtTimeFraction - 0.01);
      var dx = point.x - lastPoint.x;
      var dy = point.y - lastPoint.y;
      var rotation = Math.atan2(dy, dx);
      angle += rotation / 2 / Math.PI * 360;
    }
    value.push({t:'rotate', d: [angle]});
    compositor.setAnimatedValue(target, "transform",
        new AddReplaceCompositableValue(value, this.composite));
  },
  _lengthAtTimeFraction: function(timeFraction) {
    var segmentCount = this._cumulativeLengths.length - 1;
    if (!segmentCount) {
      return 0;
    }
    var scaledFraction = timeFraction * segmentCount;
    var index = clamp(Math.floor(scaledFraction), 0, segmentCount)
    return this._cumulativeLengths[index] + ((scaledFraction % 1) * (
        this._cumulativeLengths[index + 1] - this._cumulativeLengths[index]));
  },
  clone: function() {
    return new PathAnimationEffect(this._path.getAttribute('d'));
  },
  toString: function() {
    return '<PathAnimationEffect>';
  },
  set autoRotate(autoRotate) {
    enterModifyCurrentAnimationState();
    try {
      this._autoRotate = String(autoRotate);
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  get autoRotate() {
    return this._autoRotate;
  },
  set angle(angle) {
    enterModifyCurrentAnimationState();
    try {
      // TODO: This should probably be a string with a unit, but the spec
      //       says it's a double.
      this._angle = Number(angle);
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  get angle() {
    return this._angle;
  },
  set segments(segments) {
    enterModifyCurrentAnimationState();
    try {
      var targetSegments = this.segments;
      targetSegments.clear();
      var cumulativeLengths = [0];
      // TODO: *moving* the path segments is not correct, but pathSegList
      //       is read only
      while (segments.numberOfItems) {
        var segment = segments.getItem(0);
        targetSegments.appendItem(segment);
        if (segment.pathSegType !== SVGPathSeg.PATHSEG_MOVETO_REL &&
            segment.pathSegType !== SVGPathSeg.PATHSEG_MOVETO_ABS) {
          cumulativeLengths.push(this._path.getTotalLength());
        }
      }
      this._cumulativeLengths = cumulativeLengths;
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  get segments() {
    return this._path.pathSegList;
  }
});


var normalizeKeyframeDictionary = function(properties) {
  var result = {
    offset: null,
    composite: null,
  };
  var animationProperties = [];
  for (var property in properties) {
    // TODO: Apply the CSS property to IDL attribute algorithm.
    if (property === 'offset') {
      if (typeof properties.offset === 'number') {
        result.offset = properties.offset;
      }
    } else if (property === 'composite') {
      if (properties.composite === 'add' || properties.composite === 'replace') {
        result.composite = properties.composite;
      }
    } else {
      // TODO: Check whether this is a supported property.
      animationProperties.push(property);
    }
  }
  // TODO: Remove prefixed properties if the unprefixed version is also
  // supported and present.
  animationProperties = animationProperties.sort();
  for (var i = 0; i < animationProperties.length; i++) {
    // TODO: Apply the IDL attribute to CSS property algorithm.
    var property = animationProperties[i];
    // TODO: The spec does not specify how to handle null values.
    // See https://www.w3.org/Bugs/Public/show_bug.cgi?id=22572
    result[property] = isDefinedAndNotNull(properties[property]) ?
        properties[property].toString() : '';
  }
  return result;
};


/** @constructor */
var KeyframeAnimationEffect = function(oneOrMoreKeyframeDictionaries,
    composite, accumulate) {
  enterModifyCurrentAnimationState();
  try {
    AnimationEffect.call(this, constructorToken, accumulate);

    this.composite = composite;

    this.setFrames(oneOrMoreKeyframeDictionaries);
  } finally {
    exitModifyCurrentAnimationState(false);
  }
};

KeyframeAnimationEffect.prototype = createObject(AnimationEffect.prototype, {
  get composite() {
    return this._composite;
  },
  set composite(value) {
    enterModifyCurrentAnimationState();
    try {
      // Use the default value if an invalid string is specified.
      this._composite = value === 'add' ? 'add' : 'replace';
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  getFrames: function() {
    return this._keyframeDictionaries.slice(0);
  },
  setFrames: function(oneOrMoreKeyframeDictionaries) {
    enterModifyCurrentAnimationState();
    try {
      if (!Array.isArray(oneOrMoreKeyframeDictionaries)) {
        oneOrMoreKeyframeDictionaries = [oneOrMoreKeyframeDictionaries];
      }
      this._keyframeDictionaries =
          oneOrMoreKeyframeDictionaries.map(normalizeKeyframeDictionary);
      // Set lazily
      this._cachedProperties = null;
      this._cachedDistributedKeyframes = null;
    } finally {
      exitModifyCurrentAnimationState(true);
    }
  },
  _sample: function(timeFraction, currentIteration, target) {
    var properties = this._getProperties();
    for (var i = 0; i < properties.length; i++) {
      compositor.setAnimatedValue(target, properties[i],
          this._sampleForProperty(timeFraction, currentIteration,
              properties[i]));
    }
  },
  _sampleForProperty: function(timeFraction, currentIteration, property) {
    var frames = this._propertySpecificKeyframes(property);
    var unaccumulatedValue =
        this._unaccumulatedValueForProperty(frames, timeFraction, property);

    // We can only accumulate if this iteration is strictly positive and if all
    // keyframes use the same composite operation.
    if (this.accumulate === 'sum' &&
        currentIteration > 0 &&
        this._allKeyframesUseSameCompositeOperation(frames)) {
      // TODO: The spec is vague about the order of addition here when using add
      // composition.
      return new AccumulatedCompositableValue(unaccumulatedValue,
          this._getAccumulatingValue(frames, property), currentIteration);
    }

    return unaccumulatedValue;
  },
  _getAccumulatingValue: function(frames, property) {
    console.assert(this._allKeyframesUseSameCompositeOperation(frames),
        'Accumulation only valid if all frames use same composite operation');

    // This is a BlendedCompositableValue, though because the offset is 1.0, we
    // could simplify it to an AddReplaceCompositableValue representing the
    // keyframe at offset 1.0. We don't do this because the spec is likely to
    // change such that there is no guarantee that a keyframe with offset 1.0 is
    // present.
    // TODO: Consider caching this.
    var unaccumulatedValueAtOffsetOne =
        this._unaccumulatedValueForProperty(frames, 1.0, property);

    if (this._compositeForKeyframe(frames[0]) === 'add') {
      return unaccumulatedValueAtOffsetOne;
    }

    // For replace composition, we must evaluate the BlendedCompositableValue
    // to get a concrete value (note that the choice of underlying value is
    // irrelevant since it uses replace composition). We then form a new
    // AddReplaceCompositable value to add-composite this concrete value.
    console.assert(!unaccumulatedValueAtOffsetOne.dependsOnUnderlyingValue());
    return new AddReplaceCompositableValue(
        unaccumulatedValueAtOffsetOne.compositeOnto(property, null), 'add');
  },
  _unaccumulatedValueForProperty: function(frames, timeFraction, property) {
    console.assert(frames.length >= 2,
        'Interpolation requires at least two keyframes');

    var startKeyframeIndex;
    var length = frames.length;
    // We extrapolate differently depending on whether or not there are multiple
    // keyframes at offsets of 0 and 1.
    if (timeFraction < 0.0) {
      if (frames[1].offset === 0.0) {
        return new AddReplaceCompositableValue(
            frames[0].rawValueForProperty(property),
            this._compositeForKeyframe(frames[0]));
      } else {
        startKeyframeIndex = 0;
      }
    } else if (timeFraction >= 1.0) {
      if (frames[length - 2].offset === 1.0) {
        return new AddReplaceCompositableValue(
            frames[length - 1].rawValueForProperty(property),
            this._compositeForKeyframe(frames[length - 1]));
      } else {
        startKeyframeIndex = length - 2;
      }
    } else {
      for (var i = length - 1; i >= 0; i--) {
        if (frames[i].offset <= timeFraction) {
          console.assert(frames[i].offset !== 1.0);
          startKeyframeIndex = i;
          break;
        }
      }
    }
    var startKeyframe = frames[startKeyframeIndex];
    var endKeyframe = frames[startKeyframeIndex + 1];
    var intervalDistance = (timeFraction - startKeyframe.offset) /
        (endKeyframe.offset - startKeyframe.offset);
    return new BlendedCompositableValue(
        new AddReplaceCompositableValue(
            startKeyframe.rawValueForProperty(property),
            this._compositeForKeyframe(startKeyframe)),
        new AddReplaceCompositableValue(
            endKeyframe.rawValueForProperty(property),
            this._compositeForKeyframe(endKeyframe)),
        intervalDistance);
  },
  _propertySpecificKeyframes: function(property) {
    // TODO: Consider caching these.
    var distributedFrames = this._getDistributedKeyframes();
    var frames = [];
    for (var i = 0; i < distributedFrames.length; i++) {
      if (distributedFrames[i].hasValueForProperty(property)) {
        frames.push(distributedFrames[i]);
      }
    }
    console.assert(frames.length > 0,
        'There should always be keyframes for each property');

    // Add 0 and 1 keyframes if required.
    if (frames[0].offset !== 0.0) {
      var keyframe = new KeyframeInternal(0.0, 'add');
      keyframe.addPropertyValuePair(property, cssNeutralValue);
      frames.unshift(keyframe);
    }
    if (frames[frames.length - 1].offset !== 1.0) {
      var keyframe = new KeyframeInternal(1.0, 'add');
      keyframe.addPropertyValuePair(property, cssNeutralValue);
      frames.push(keyframe);
    }
    console.assert(frames.length >= 2,
        'There should be at least two keyframes including synthetic keyframes');

    return frames;
  },
  clone: function() {
    var result = new KeyframeAnimationEffect([], this.composite,
        this.accumulate);
    result._keyframeDictionaries = this._keyframeDictionaries.slice(0);
    return result;
  },
  toString: function() {
    return '<KeyframeAnimationEffect>';
  },
  _compositeForKeyframe: function(keyframe) {
    return isDefinedAndNotNull(keyframe.composite) ?
        keyframe.composite : this.composite;
  },
  _allKeyframesUseSameCompositeOperation: function(keyframes) {
    console.assert(keyframes.length >= 1, 'This requires at least one keyframe');
    var composite = this._compositeForKeyframe(keyframes[0]);
    for (var i = 1; i < keyframes.length; i++) {
      if (this._compositeForKeyframe(keyframes[i]) !== composite) {
        return false;
      }
    }
    return true;
  },
  _areKeyframeDictionariesLooselySorted: function() {
    var previousOffset = -Infinity;
    for (var i = 0; i < this._keyframeDictionaries.length; i++) {
      if (isDefinedAndNotNull(this._keyframeDictionaries[i].offset)) {
        if (this._keyframeDictionaries[i].offset < previousOffset) {
          return false;
        }
        previousOffset = this._keyframeDictionaries[i].offset;
      }
    }
    return true;
  },
  // The spec describes both this process and the process for interpretting the
  // properties of a keyframe dictionary as 'normalizing'. Here we use the term
  // 'distributing' to avoid confusion with normalizeKeyframeDictionary().
  _getDistributedKeyframes: function() {
    if (isDefinedAndNotNull(this._cachedDistributedKeyframes)) {
      return this._cachedDistributedKeyframes;
    }

    this._cachedDistributedKeyframes = [];
    if (!this._areKeyframeDictionariesLooselySorted()) {
      return this._cachedDistributedKeyframes;
    }

    this._cachedDistributedKeyframes = this._keyframeDictionaries.map(
        KeyframeInternal.createFromNormalizedProperties);

    // Remove keyframes with offsets out of bounds.
    var length = this._cachedDistributedKeyframes.length;
    var count = 0;
    for (var i = 0; i < length; i++) {
      var offset = this._cachedDistributedKeyframes[i].offset;
      if (isDefinedAndNotNull(offset)) {
        if (offset >= 0) {
          break;
        } else {
          count = i;
        }
      }
    }
    this._cachedDistributedKeyframes.splice(0, count);

    length = this._cachedDistributedKeyframes.length;
    count = 0;
    for (var i = length - 1; i >= 0; i--) {
      var offset = this._cachedDistributedKeyframes[i].offset;
      if (isDefinedAndNotNull(offset)) {
        if (offset <= 1) {
          break;
        } else {
          count = length - i;
        }
      }
    }
    this._cachedDistributedKeyframes.splice(length - count, count);

    // Distribute offsets.
    length = this._cachedDistributedKeyframes.length;
    if (length > 1 && !isDefinedAndNotNull(this._cachedDistributedKeyframes[0].offset)) {
      this._cachedDistributedKeyframes[0].offset = 0;
    }
    if (!isDefinedAndNotNull(this._cachedDistributedKeyframes[length - 1].offset)) {
      this._cachedDistributedKeyframes[length - 1].offset = 1;
    }
    var lastOffsetIndex = 0;
    var nextOffsetIndex = 0;
    for (var i = 1; i < this._cachedDistributedKeyframes.length - 1; i++) {
      var keyframe = this._cachedDistributedKeyframes[i];
      if (isDefinedAndNotNull(keyframe.offset)) {
        lastOffsetIndex = i;
        continue;
      }
      if (i > nextOffsetIndex) {
        nextOffsetIndex = i;
        while (!isDefinedAndNotNull(
            this._cachedDistributedKeyframes[nextOffsetIndex].offset)) {
          nextOffsetIndex++;
        }
      }
      var lastOffset = this._cachedDistributedKeyframes[lastOffsetIndex].offset;
      var nextOffset = this._cachedDistributedKeyframes[nextOffsetIndex].offset;
      var unspecifiedKeyframes = nextOffsetIndex - lastOffsetIndex - 1;
      console.assert(unspecifiedKeyframes > 0);
      var localIndex = i - lastOffsetIndex;
      console.assert(localIndex > 0);
      this._cachedDistributedKeyframes[i].offset = lastOffset +
          (nextOffset - lastOffset) * localIndex / (unspecifiedKeyframes + 1);
    }

    // Remove invalid property values.
    for (var i = this._cachedDistributedKeyframes.length - 1; i >= 0; i--) {
      var keyframe = this._cachedDistributedKeyframes[i];
      for (var property in keyframe.cssValues) {
        if (!KeyframeInternal.isSupportedPropertyValue(
            keyframe.cssValues[property])) {
          delete(keyframe.cssValues[property]);
        }
      }
      if (Object.keys(keyframe).length === 0) {
        this._cachedDistributedKeyframes.splice(i, 1);
      }
    }

    return this._cachedDistributedKeyframes;
  },
  _getProperties: function() {
    if (!isDefinedAndNotNull(this._cachedProperties)) {
      var properties = {};
      var frames = this._getDistributedKeyframes();
      for (var i = 0; i < frames.length; i++) {
        for (var property in frames[i].cssValues) {
          properties[property] = true;
        }
      }
      this._cachedProperties = [];
      for (var p in properties) {
        if (properties.hasOwnProperty(p)) {
          this._cachedProperties.push(p);
        }
      }
    }
    return this._cachedProperties;
  }
});


// An internal representation of a keyframe. The Keyframe type from the spec is
// just a dictionary and is not exposed.
/** @constructor */
var KeyframeInternal = function(offset, composite) {
  console.assert(typeof offset === 'number' || offset === null,
      'Invalid offset value');
  console.assert(composite === 'add' || composite === 'replace' || composite === null,
      'Invalid composite value');
  this.offset = offset;
  this.composite = composite;
  this.cssValues = {};
  // Set lazily
  this.rawValues = {};
};

KeyframeInternal.prototype = {
  rawValueForProperty: function(property) {
    if (!isDefinedAndNotNull(this.rawValues[property])) {
      this.rawValues[property] = fromCssValue(property, this.cssValues[property]);
    }
    return this.rawValues[property];
  },
  addPropertyValuePair: function(property, value) {
    console.assert(!this.cssValues.hasOwnProperty(property));
    this.cssValues[property] = value;
  },
  hasValueForProperty: function(property) {
    return this.cssValues.hasOwnProperty(property);
  }
};

KeyframeInternal.isSupportedPropertyValue = function(value) {
  console.assert(typeof value === 'string' || value === cssNeutralValue);
  // TODO: Check this properly!
  return value !== '';
};

KeyframeInternal.createFromNormalizedProperties = function(properties) {
  console.assert(
      isDefinedAndNotNull(properties) && typeof properties === 'object',
      'Properties must be an object');
  var keyframe = new KeyframeInternal(properties.offset, properties.composite);
  for (var candidate in properties) {
    if (candidate !== 'offset' && candidate !== 'composite') {
      keyframe.addPropertyValuePair(candidate, properties[candidate]);
    }
  }
  return keyframe;
};

/** @constructor */
var TimingFunction = function() {
  throw new TypeError('Illegal constructor');
};

TimingFunction.prototype.scaleTime = abstractMethod;

TimingFunction.createFromString = function(spec, timedItem) {
  var preset = presetTimingFunctions[spec];
  if (preset) {
    return preset;
  }
  if (spec === 'paced') {
    if (timedItem instanceof Animation &&
        timedItem.effect instanceof PathAnimationEffect) {
      return new PacedTimingFunction(timedItem);
    }
    return presetTimingFunctions.linear;
  }
  var stepMatch = /steps\(\s*(\d+)\s*,\s*(start|end|middle)\s*\)/.exec(spec);
  if (stepMatch) {
    return new StepTimingFunction(Number(stepMatch[1]), stepMatch[2]);
  }
  var bezierMatch =
      /cubic-bezier\(([^,]*),([^,]*),([^,]*),([^)]*)\)/.exec(spec);
  if (bezierMatch) {
    return new SplineTimingFunction([
        Number(bezierMatch[1]),
        Number(bezierMatch[2]),
        Number(bezierMatch[3]),
        Number(bezierMatch[4])]);
  }
  return presetTimingFunctions.linear;
};

/** @constructor */
var SplineTimingFunction = function(spec) {
  this.params = spec;
  this.map = []
  for (var ii = 0; ii <= 100; ii += 1) {
    var i = ii / 100;
    this.map.push([
      3*i*(1-i)*(1-i)*this.params[0] + 3*i*i*(1-i)*this.params[2] + i*i*i,
      3*i*(1-i)*(1-i)*this.params[1] + 3*i*i*(1-i)*this.params[3] + i*i*i
    ]);
  }
};

SplineTimingFunction.prototype = createObject(TimingFunction.prototype, {
  scaleTime: function(fraction) {
    var fst = 0;
    while (fst != 100 && fraction > this.map[fst][0]) {
      fst += 1;
    }
    if (fraction == this.map[fst][0] || fst == 0) {
      return this.map[fst][1];
    }
    var yDiff = this.map[fst][1] - this.map[fst - 1][1];
    var xDiff = this.map[fst][0] - this.map[fst - 1][0];
    var p = (fraction - this.map[fst - 1][0]) / xDiff;
    return this.map[fst - 1][1] + p * yDiff;
  }
});

var presetTimingFunctions = {
  'linear': null,
  'ease': new SplineTimingFunction([0.25, 0.1, 0.25, 1.0]),
  'ease-in': new SplineTimingFunction([0.42, 0, 1.0, 1.0]),
  'ease-out': new SplineTimingFunction([0, 0, 0.58, 1.0]),
  'ease-in-out': new SplineTimingFunction([0.42, 0, 0.58, 1.0]),
};


/** @constructor */
var StepTimingFunction = function(numSteps, position) {
  this.numSteps = numSteps;
  this.position = position || 'end';
};

StepTimingFunction.prototype = createObject(TimingFunction.prototype, {
  scaleTime: function(fraction) {
    if (fraction >= 1)
      return 1;
    var stepSize = 1 / this.numSteps;
    if (this.position == 'start') {
      fraction += stepSize;
    } else if (this.position == 'middle') {
      fraction += stepSize / 2;
    }
    return fraction - fraction % stepSize;
  },
});

/** @constructor */
var PacedTimingFunction = function(timedItem) {
  this._timedItem = timedItem;
};

PacedTimingFunction.prototype = createObject(TimingFunction.prototype, {
  scaleTime: function(fraction) {
    var cumulativeLengths = this._timedItem.effect._cumulativeLengths;
    var totalLength = cumulativeLengths[cumulativeLengths.length - 1];
    if (!totalLength || fraction <= 0) {
      return 0;
    }
    var length = fraction * totalLength;
    var leftIndex = this._findLeftIndex(cumulativeLengths, length);
    if (leftIndex >= cumulativeLengths.length - 1) {
      return 1;
    }
    var leftLength = cumulativeLengths[leftIndex];
    var segmentLength = cumulativeLengths[leftIndex + 1] - leftLength;
    if (segmentLength > 0) {
      return (leftIndex + ((length - leftLength) / segmentLength)) /
          (cumulativeLengths.length - 1);
    }
    return leftLength / cumulativeLengths.length;
  },
  _findLeftIndex: function(array, value) {
    var leftIndex = 0;
    var rightIndex = array.length;
    while (rightIndex - leftIndex > 1) {
      var midIndex = (leftIndex + rightIndex) >> 1;
      if (array[midIndex] <= value) {
        leftIndex = midIndex;
      } else {
        rightIndex = midIndex;
      }
    }
    return leftIndex;
  },
});

var interp = function(from, to, f, type) {
  if (Array.isArray(from) || Array.isArray(to)) {
    return interpArray(from, to, f, type);
  }
  var zero = type == 'scale' ? 1.0 : 0.0;
  to   = isDefinedAndNotNull(to) ? to : zero;
  from = isDefinedAndNotNull(from) ? from : zero;

  return to * f + from * (1 - f);
};

var interpArray = function(from, to, f, type) {
  console.assert(Array.isArray(from) || from === null,
      'From is not an array or null');
  console.assert(Array.isArray(to) || to === null,
      'To is not an array or null');
  console.assert(from === null || to === null || from.length === to.length,
      'Arrays differ in length ' + from + " : " + to);
  var length = from ? from.length : to.length;

  var result = [];
  for (var i = 0; i < length; i++) {
    result[i] = interp(from ? from[i] : null, to ? to[i] : null, f, type);
  }
  return result;
};

// TODO: This type does not handle 'inherit'.
var numberType = {
  add: function(base, delta) {
    // If base or delta are 'auto', we fall back to replacement.
    if (base === 'auto' || delta === 'auto') {
      return nonNumericType.add(base, delta);
    }
    return base + delta;
  },
  interpolate: function(from, to, f) {
    // If from or to are 'auto', we fall back to step interpolation.
    if (from === 'auto' || to === 'auto') {
      return nonNumericType.interpolate(from, to);
    }
    return interp(from, to, f);
  },
  toCssValue: function(value) { return value + ''; },
  fromCssValue: function(value) {
    if (value === 'auto') {
      return 'auto';
    }
    var result = Number(value);
    return isNaN(result) ? undefined : result;
  },
};

// TODO: This type does not handle 'inherit'.
var integerType = createObject(numberType, {
  interpolate: function(from, to, f) {
    // If from or to are 'auto', we fall back to step interpolation.
    if (from === 'auto' || to === 'auto') {
      return nonNumericType.interpolate(from, to);
    }
    return Math.floor(interp(from, to, f));
  }
});

var fontWeightType = {
  add: function(base, delta) { return base + delta; },
  interpolate: function(from, to, f) {
    return interp(from, to, f);
  },
  toCssValue: function(value) {
    value = Math.round(value / 100) * 100
    value = clamp(value, 100, 900);
    if (value === 400) {
      return 'normal';
    }
    if (value === 700) {
      return 'bold';
    }
    return String(value);
  },
  fromCssValue: function(value) {
    if (value === 'normal') {
      return 400;
    }
    if (value === 'bold') {
      return 700;
    }
    // TODO: support lighter / darker ?
    var out = Number(value);
    if (isNaN(out) || out < 100 || out > 900 || out % 100 !== 0) {
      return undefined;
    }
    return out;
  }
};

// This regular expression is intentionally permissive, so that
// platform-prefixed versions of calc will still be accepted as
// input. While we are restrictive with the transform property
// name, we need to be able to read underlying calc values from
// computedStyle so can't easily restrict the input here.
var outerCalcRE = /calc\s*\(\s*([^)]*)\)/;
var valueRE = /\s*(-?[0-9.]*)([a-zA-Z%]*)/;
var operatorRE = /\s*([+-])/;
var percentLengthType = {
  isAuto: function(x) {
    if ('auto' in x) {
      console.assert(Object.keys(x).length === 1,
          'percentLengthType should not contain auto with other values');
      return true;
    }
    return false;
  },
  zero: function() { return {}; },
  add: function(base, delta) {
    // If base or delta are 'auto', we fall back to replacement.
    if (percentLengthType.isAuto(base) || percentLengthType.isAuto(delta)) {
      return nonNumericType.add(base, delta);
    }
    var out = {};
    for (var value in base) {
      out[value] = base[value] + (delta[value] || 0);
    }
    for (value in delta) {
      if (value in base) {
        continue;
      }
      out[value] = delta[value];
    }
    return out;
  },
  interpolate: function(from, to, f) {
    // If from or to are 'auto', we fall back to step interpolation.
    if (percentLengthType.isAuto(from) || percentLengthType.isAuto(to)) {
      return nonNumericType.interpolate(from, to);
    }
    var out = {};
    for (var value in from) {
      out[value] = interp(from[value], to[value], f);
    }
    for (var value in to) {
      if (value in out) {
        continue;
      }
      out[value] = interp(0, to[value], f);
    }
    return out;
  },
  toCssValue: function(value) {
    var s = '';
    var single_value = true;
    for (var item in value) {
      if (s === '') {
        s = value[item] + item;
      } else if (single_value) {
        s = features.calcFunction + '(' + s + ' + ' + value[item] + item + ')';
        single_value = false;
      } else {
        s = s.substring(0, s.length - 1) + ' + ' + value[item] + item + ')';
      }
    }
    return s;
  },
  fromCssValue: function(value) {
    var out = {}
    var innards = outerCalcRE.exec(value);
    if (!innards) {
      var singleValue = valueRE.exec(value);
      if (singleValue && (singleValue.length == 3)) {
        out[singleValue[2]] = Number(singleValue[1]);
        return out;
      }
      return undefined;
    }
    innards = innards[1];
    var first_time = true;
    while (true) {
      var reversed = false;
      if (first_time) {
        first_time = false;
      } else {
        var op = operatorRE.exec(innards);
        if (!op) {
          return undefined;
        }
        if (op[1] == '-') {
          reversed = true;
        }
        innards = innards.substring(op[0].length);
      }
      value = valueRE.exec(innards);
      if (!value) {
        return undefined;
      }
      if (!isDefinedAndNotNull(out[value[2]])) {
        out[value[2]] = 0;
      }
      if (reversed) {
        out[value[2]] -= Number(value[1]);
      } else {
        out[value[2]] += Number(value[1]);
      }
      innards = innards.substring(value[0].length);
      if (/\s*/.exec(innards)[0].length == innards.length) {
        return out;
      }
    }
  }
};

var rectangleRE = /rect\(([^,]+),([^,]+),([^,]+),([^)]+)\)/;
var rectangleType = {
  add: function(base, delta) {
    return {
      top: percentLengthType.add(base.top, delta.top),
      right: percentLengthType.add(base.right, delta.right),
      bottom: percentLengthType.add(base.bottom, delta.bottom),
      left: percentLengthType.add(base.left, delta.left)
    };
  },
  interpolate: function(from, to, f) {
    return {
      top: percentLengthType.interpolate(from.top, to.top, f),
      right: percentLengthType.interpolate(from.right, to.right, f),
      bottom: percentLengthType.interpolate(from.bottom, to.bottom, f),
      left: percentLengthType.interpolate(from.left, to.left, f)
    };
  },
  toCssValue: function(value) {
    if (percentLengthType.isAuto(value.top) &&
        percentLengthType.isAuto(value.right) &&
        percentLengthType.isAuto(value.bottom) &&
        percentLengthType.isAuto(value.left)) {
      return 'auto';
    }
    return 'rect(' +
        percentLengthType.toCssValue(value.top) + ',' +
        percentLengthType.toCssValue(value.right) + ',' +
        percentLengthType.toCssValue(value.bottom) + ',' +
        percentLengthType.toCssValue(value.left) + ')';
  },
  fromCssValue: function(value) {
    if (value === 'auto') {
      return {
        top: percentLengthType.fromCssValue('auto'),
        right: percentLengthType.fromCssValue('auto'),
        bottom: percentLengthType.fromCssValue('auto'),
        left: percentLengthType.fromCssValue('auto'),
      };
    }
    var match = rectangleRE.exec(value);
    if (!match) {
      return undefined;
    }
    var out = {
      top: percentLengthType.fromCssValue(match[1]),
      right: percentLengthType.fromCssValue(match[2]),
      bottom: percentLengthType.fromCssValue(match[3]),
      left: percentLengthType.fromCssValue(match[4])
    };
    if (out.top && out.right && out.bottom && out.left) {
      return out;
    }
    return undefined;
  }
};

var shadowType = {
  zero: function() {
    return {
      hOffset: lengthType.zero(),
      vOffset: lengthType.zero(),
    };
  },
  _addSingle: function(base, delta) {
    if (base && delta && base.inset != delta.inset) {
      return delta;
    }
    var result = {
      inset: base ? base.inset : delta.inset,
      hOffset: lengthType.add(
          base ? base.hOffset : lengthType.zero(),
          delta ? delta.hOffset : lengthType.zero()),
      vOffset: lengthType.add(
          base ? base.vOffset : lengthType.zero(),
          delta ? delta.vOffset : lengthType.zero()),
      blur: lengthType.add(
          base && base.blur || lengthType.zero(),
          delta && delta.blur || lengthType.zero()),
    };
    if (base && base.spread || delta && delta.spread) {
      result.spread = lengthType.add(
          base && base.spread || lengthType.zero(),
          delta && delta.spread || lengthType.zero());
    }
    if (base && base.color || delta && delta.color) {
      result.color = colorType.add(
          base && base.color || colorType.zero(),
          delta && delta.color || colorType.zero());
    }
    return result;
  },
  add: function(base, delta) {
    var result = [];
    for (var i = 0; i < base.length || i < delta.length; i++) {
      result.push(this._addSingle(base[i], delta[i]));
    }
    return result;
  },
  _interpolateSingle: function(from, to, f) {
    if (from && to && from.inset != to.inset) {
      return f < 0.5 ? from : to;
    }
    var result = {
      inset: from ? from.inset : to.inset,
      hOffset: lengthType.interpolate(
          from ? from.hOffset : lengthType.zero(),
          to ? to.hOffset : lengthType.zero(), f),
      vOffset: lengthType.interpolate(
          from ? from.vOffset : lengthType.zero(),
          to ? to.vOffset : lengthType.zero(), f),
      blur: lengthType.interpolate(
          from && from.blur || lengthType.zero(),
          to && to.blur || lengthType.zero(), f),
    };
    if (from && from.spread || to && to.spread) {
      result.spread = lengthType.interpolate(
          from && from.spread || lengthType.zero(),
          to && to.spread || lengthType.zero(), f);
    }
    if (from && from.color || to && to.color) {
      result.color = colorType.interpolate(
          from && from.color || colorType.zero(),
          to && to.color || colorType.zero(), f);
    }
    return result;
  },
  interpolate: function(from, to, f) {
    var result = [];
    for (var i = 0; i < from.length || i < to.length; i++) {
      result.push(this._interpolateSingle(from[i], to[i], f));
    }
    return result;
  },
  _toCssValueSingle: function(value) {
    return (value.inset ? 'inset ' : '') +
        lengthType.toCssValue(value.hOffset) + ' ' +
        lengthType.toCssValue(value.vOffset) + ' ' +
        lengthType.toCssValue(value.blur) +
        (value.spread ? ' ' + lengthType.toCssValue(value.spread) : '') +
        (value.color ? ' ' + colorType.toCssValue(value.color) : '');
  },
  toCssValue: function(value) {
    return value.map(this._toCssValueSingle).join(', ');
  },
  // TODO: This should handle the case where the color comes before the
  // lengths.
  fromCssValue: function(value) {
    var shadows = value.split(/\s*,\s*/);
    var result = shadows.map(function(value) {
      if (value === 'none') {
        return shadowType.zero();
      }
      value = value.replace(/^\s+|\s+$/g, '');
      var parts = value.split(/\s+/);
      if (parts.length < 2 || parts.length > 6) {
        return undefined;
      }
      var result = {
        inset: false
      };
      if (parts[0] == 'inset') {
        parts.shift();
        result.inset = true;
      }
      var color;
      var lengths = [];
      while (parts.length) {
        var part = parts.shift();
        color = colorType.fromCssValue(part);
        if (color) {
          result.color = color;
          if (parts.length) {
            return undefined;
          }
          break;
        }
        var length = lengthType.fromCssValue(part);
        if (!length) {
          return undefined;
        }
        lengths.push(length);
      }
      if (lengths.length < 2 || lengths.length > 4) {
        return undefined;
      }
      result.hOffset = lengths[0];
      result.vOffset = lengths[1];
      if (lengths.length > 2) {
        result.blur = lengths[2];
      }
      if (lengths.length > 3) {
        result.spread = lengths[3];
      }
      if (color) {
        result.color = color;
      }
      return result;
    });
    return result.every(isDefined) ? result : undefined;
  }
};

var nonNumericType = {
  add: function(base, delta) {
    return isDefined(delta) ? delta : base;
  },
  interpolate: function(from, to, f) {
    return f < 0.5 ? from : to;
  },
  toCssValue: function(value) {
    return value;
  },
  fromCssValue: function(value) {
    return value;
  },
};

var visibilityType = createObject(nonNumericType, {
  interpolate: function(from, to, f) {
    if (from != 'visible' && to != 'visible') {
      return nonNumericType.interpolate(from, to, f);
    }
    if (f <= 0) {
      return from;
    }
    if (f >= 1) {
      return to;
    }
    return 'visible';
  },
  fromCssValue: function(value) {
    if (['visible', 'hidden', 'collapse'].indexOf(value) !== -1) {
      return value;
    }
    return undefined;
  },
});

var lengthType = percentLengthType;

var rgbRE = /^\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/;
var rgbaRE =
    /^\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)/;

var namedColors = {
  aliceblue: [240, 248, 255, 1], antiquewhite: [250, 235, 215, 1],
  aqua: [0, 255, 255, 1], aquamarine: [127, 255, 212, 1],
  azure: [240, 255, 255, 1], beige: [245, 245, 220, 1],
  bisque: [255, 228, 196, 1], black: [0, 0, 0, 1],
  blanchedalmond: [255, 235, 205, 1], blue: [0, 0, 255, 1],
  blueviolet: [138, 43, 226, 1], brown: [165, 42, 42, 1],
  burlywood: [222, 184, 135, 1], cadetblue: [95, 158, 160, 1],
  chartreuse: [127, 255, 0, 1], chocolate: [210, 105, 30, 1],
  coral: [255, 127, 80, 1], cornflowerblue: [100, 149, 237, 1],
  cornsilk: [255, 248, 220, 1], crimson: [220, 20, 60, 1],
  cyan: [0, 255, 255, 1], darkblue: [0, 0, 139, 1],
  darkcyan: [0, 139, 139, 1], darkgoldenrod: [184, 134, 11, 1],
  darkgray: [169, 169, 169, 1], darkgreen: [0, 100, 0, 1],
  darkgrey: [169, 169, 169, 1], darkkhaki: [189, 183, 107, 1],
  darkmagenta: [139, 0, 139, 1], darkolivegreen: [85, 107, 47, 1],
  darkorange: [255, 140, 0, 1], darkorchid: [153, 50, 204, 1],
  darkred: [139, 0, 0, 1], darksalmon: [233, 150, 122, 1],
  darkseagreen: [143, 188, 143, 1], darkslateblue: [72, 61, 139, 1],
  darkslategray: [47, 79, 79, 1], darkslategrey: [47, 79, 79, 1],
  darkturquoise: [0, 206, 209, 1], darkviolet: [148, 0, 211, 1],
  deeppink: [255, 20, 147, 1], deepskyblue: [0, 191, 255, 1],
  dimgray: [105, 105, 105, 1], dimgrey: [105, 105, 105, 1],
  dodgerblue: [30, 144, 255, 1], firebrick: [178, 34, 34, 1],
  floralwhite: [255, 250, 240, 1], forestgreen: [34, 139, 34, 1],
  fuchsia: [255, 0, 255, 1], gainsboro: [220, 220, 220, 1],
  ghostwhite: [248, 248, 255, 1], gold: [255, 215, 0, 1],
  goldenrod: [218, 165, 32, 1], gray: [128, 128, 128, 1],
  green: [0, 128, 0, 1], greenyellow: [173, 255, 47, 1],
  grey: [128, 128, 128, 1], honeydew: [240, 255, 240, 1],
  hotpink: [255, 105, 180, 1], indianred: [205, 92, 92, 1],
  indigo: [75, 0, 130, 1], ivory: [255, 255, 240, 1],
  khaki: [240, 230, 140, 1], lavender: [230, 230, 250, 1],
  lavenderblush: [255, 240, 245, 1], lawngreen: [124, 252, 0, 1],
  lemonchiffon: [255, 250, 205, 1], lightblue: [173, 216, 230, 1],
  lightcoral: [240, 128, 128, 1], lightcyan: [224, 255, 255, 1],
  lightgoldenrodyellow: [250, 250, 210, 1], lightgray: [211, 211, 211, 1],
  lightgreen: [144, 238, 144, 1], lightgrey: [211, 211, 211, 1],
  lightpink: [255, 182, 193, 1], lightsalmon: [255, 160, 122, 1],
  lightseagreen: [32, 178, 170, 1], lightskyblue: [135, 206, 250, 1],
  lightslategray: [119, 136, 153, 1], lightslategrey: [119, 136, 153, 1],
  lightsteelblue: [176, 196, 222, 1], lightyellow: [255, 255, 224, 1],
  lime: [0, 255, 0, 1], limegreen: [50, 205, 50, 1],
  linen: [250, 240, 230, 1], magenta: [255, 0, 255, 1],
  maroon: [128, 0, 0, 1], mediumaquamarine: [102, 205, 170, 1],
  mediumblue: [0, 0, 205, 1], mediumorchid: [186, 85, 211, 1],
  mediumpurple: [147, 112, 219, 1], mediumseagreen: [60, 179, 113, 1],
  mediumslateblue: [123, 104, 238, 1], mediumspringgreen: [0, 250, 154, 1],
  mediumturquoise: [72, 209, 204, 1], mediumvioletred: [199, 21, 133, 1],
  midnightblue: [25, 25, 112, 1], mintcream: [245, 255, 250, 1],
  mistyrose: [255, 228, 225, 1], moccasin: [255, 228, 181, 1],
  navajowhite: [255, 222, 173, 1], navy: [0, 0, 128, 1],
  oldlace: [253, 245, 230, 1], olive: [128, 128, 0, 1],
  olivedrab: [107, 142, 35, 1], orange: [255, 165, 0, 1],
  orangered: [255, 69, 0, 1], orchid: [218, 112, 214, 1],
  palegoldenrod: [238, 232, 170, 1], palegreen: [152, 251, 152, 1],
  paleturquoise: [175, 238, 238, 1], palevioletred: [219, 112, 147, 1],
  papayawhip: [255, 239, 213, 1], peachpuff: [255, 218, 185, 1],
  peru: [205, 133, 63, 1], pink: [255, 192, 203, 1],
  plum: [221, 160, 221, 1], powderblue: [176, 224, 230, 1],
  purple: [128, 0, 128, 1], red: [255, 0, 0, 1],
  rosybrown: [188, 143, 143, 1], royalblue: [65, 105, 225, 1],
  saddlebrown: [139, 69, 19, 1], salmon: [250, 128, 114, 1],
  sandybrown: [244, 164, 96, 1], seagreen: [46, 139, 87, 1],
  seashell: [255, 245, 238, 1], sienna: [160, 82, 45, 1],
  silver: [192, 192, 192, 1], skyblue: [135, 206, 235, 1],
  slateblue: [106, 90, 205, 1], slategray: [112, 128, 144, 1],
  slategrey: [112, 128, 144, 1], snow: [255, 250, 250, 1],
  springgreen: [0, 255, 127, 1], steelblue: [70, 130, 180, 1],
  tan: [210, 180, 140, 1], teal: [0, 128, 128, 1],
  thistle: [216, 191, 216, 1], tomato: [255, 99, 71, 1],
  turquoise: [64, 224, 208, 1], violet: [238, 130, 238, 1],
  wheat: [245, 222, 179, 1], white: [255, 255, 255, 1],
  whitesmoke: [245, 245, 245, 1], yellow: [255, 255, 0, 1],
  yellowgreen: [154, 205, 50, 1]
};

var colorType = {
  zero: function() { return [0,0,0,0]; },
  add: function(base, delta) {
    return [base[0] + delta[0], base[1] + delta[1],
            base[2] + delta[2], base[3] + delta[3]];
  },
  interpolate: function(from, to, f) {
    return [interp(from[0], to[0], f), interp(from[1], to[1], f),
            interp(from[2], to[2], f), interp(from[3], to[3], f)];
  },
  toCssValue: function(value) {
    return 'rgba(' + Math.round(value[0]) + ', ' + Math.round(value[1]) +
              ', ' + Math.round(value[2]) + ', ' + value[3] + ')';
  },
  fromCssValue: function(value) {
    var r = rgbRE.exec(value);
    if (r) {
      var out = [Number(r[1]), Number(r[2]), Number(r[3]), 1];
      if (out.some(isNaN)) {
        return undefined;
      }
      return out;
    }
    r = rgbaRE.exec(value);
    if (r) {
      var out = [Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4])];
      if (out.some(isNaN)) {
        return undefined;
      }
      return out;
    }
    return namedColors[value];
  }
};

var convertToDeg = function(num, type) {
  switch (type) {
  case 'grad':
    return num / 400 * 360;
  case 'rad':
    return num / 2 / Math.PI * 360;
  case 'turn':
    return num * 360;
  default:
    return num;
  }
};

var extractValue = function(values, pos, hasUnits) {
  var value = Number(values[pos]);
  if (!hasUnits) {
    return value;
  }
  var type = values[pos + 1];
  if (type == '') { type = 'px'; }
  var result = {};
  result[type] = value;
  return result;
}

var extractValues = function(values, numValues, hasOptionalValue, 
    hasUnits) {
  var result = [];
  for (var i = 0; i < numValues; i++) {
    result.push(extractValue(values, 1 + 2 * i, hasUnits));
  }
  if (hasOptionalValue && values[1 + 2 * numValues]) {
    result.push(extractValue(values, 1 + 2 * numValues, hasUnits));
  }
  return result;
};

var SPACES = '\\s*';
var NUMBER = '[+-]?(?:\\d+|\\d*\\.\\d+)';
var RAW_OPEN_BRACKET = '\\(';
var RAW_CLOSE_BRACKET = '\\)';
var RAW_COMMA = ',';
var UNIT = '[a-zA-Z%]*';
var START = '^';

function capture(x) { return '(' + x + ')'; }
function optional(x) { return '(?:' + x + ')?'; }

var OPEN_BRACKET = [SPACES, RAW_OPEN_BRACKET, SPACES].join("");
var CLOSE_BRACKET = [SPACES, RAW_CLOSE_BRACKET, SPACES].join("");
var COMMA = [SPACES, RAW_COMMA, SPACES].join("");
var UNIT_NUMBER = [capture(NUMBER), capture(UNIT)].join("");

function transformRE(name, numParms, hasOptionalParm) {
  var tokenList = [START, SPACES, name, OPEN_BRACKET];
  for (var i = 0; i < numParms - 1; i++) {
    tokenList.push(UNIT_NUMBER);
    tokenList.push(COMMA);
  }
  tokenList.push(UNIT_NUMBER);
  if (hasOptionalParm) {
    tokenList.push(optional([COMMA, UNIT_NUMBER].join("")));
  }
  tokenList.push(CLOSE_BRACKET);
  return new RegExp(tokenList.join("")); 
}

function buildMatcher(name, numValues, hasOptionalValue, hasUnits,
    baseValue) {
  var baseName = name;
  if (baseValue) {
    if (name[name.length - 1] == 'X' || name[name.length - 1] == 'Y') {
      baseName = name.substring(0, name.length - 1);
    } else if (name[name.length - 1] == 'Z') {
      baseName = name.substring(0, name.length - 1) + "3d";
    }
  }
  
  return [transformRE(name, numValues, hasOptionalValue),
      function(x) { 
        var r = extractValues(x, numValues, hasOptionalValue, hasUnits);
        if (baseValue !== undefined) {
          if (name[name.length - 1] == 'X') {
            r.push(baseValue);
          } else if (name[name.length - 1] == 'Y') {
            r = [baseValue].concat(r);
          } else if (name[name.length - 1] == 'Z') {
            r = [baseValue, baseValue].concat(r);
          } else if (hasOptionalValue) {
            while (r.length < 2) {
              if (baseValue == "copy") {
                r.push(r[0]);
              } else {
                r.push(baseValue);
              }
            }
          }
        }
        return r;
      },
      baseName];
}

function buildRotationMatcher(name, numValues, hasOptionalValue, 
    baseValue) {
  var m = buildMatcher(name, numValues, hasOptionalValue, true, baseValue);
  return [m[0], 
      function(x) {
        var r = m[1](x);
        return r.map(function(v) {
          var result = 0;
          for (var type in v) {
            result += convertToDeg(v[type], type);
          }
          return result;
        });
      },
      m[2]];
}

function build3DRotationMatcher() {
  var m = buildMatcher('rotate3d', 4, false, true);
  return [m[0],
    function(x) {
      var r = m[1](x);
      var out = [];
      for (var i = 0; i < 3; i++) {
        out.push(r[i].px);
      }
      out.push(r[3]);
      return out;
    },
    m[2]];
}

var transformREs = [
  buildRotationMatcher('rotate', 1, false),
  buildRotationMatcher('rotateX', 1, false),
  buildRotationMatcher('rotateY', 1, false),
  buildRotationMatcher('rotateZ', 1, false),
  build3DRotationMatcher(),
  buildRotationMatcher('skew', 1, true, 0),
  buildRotationMatcher('skewX', 1, false),
  buildRotationMatcher('skewY', 1, false),
  buildMatcher('translateX', 1, false, true, {px: 0}),
  buildMatcher('translateY', 1, false, true, {px: 0}),
  buildMatcher('translateZ', 1, false, true, {px: 0}),
  buildMatcher('translate', 1, true, true, {px: 0}),
  buildMatcher('translate3d', 3, false, true),
  buildMatcher('scale', 1, true, false, "copy"),
  buildMatcher('scaleX', 1, false, false, 1),
  buildMatcher('scaleY', 1, false, false, 1),
  buildMatcher('scaleZ', 1, false, false, 1),
  buildMatcher('scale3d', 3, false, false),
  buildMatcher('perspective', 1, false, true),
  buildMatcher('matrix', 6, false, false)
];

var decomposeMatrix = function() {
  // this is only ever used on the perspective matrix, which has 0, 0, 0, 1 as
  // last column
  function determinant(m) {
    return m[0][0] * m[1][1] * m[2][2] + 
           m[1][0] * m[2][1] * m[0][2] +
           m[2][0] * m[0][1] * m[1][2] -
           m[0][2] * m[1][1] * m[2][0] -
           m[1][2] * m[2][1] * m[0][0] -
           m[2][2] * m[0][1] * m[1][0];
  }

  // this is only ever used on the perspective matrix, which has 0, 0, 0, 1 as
  // last column
  //
  // from Wikipedia:
  //
  // [A B]^-1 = [A^-1 + A^-1B(D - CA^-1B)^-1CA^-1     -A^-1B(D - CA^-1B)^-1]
  // [C D]      [-(D - CA^-1B)^-1CA^-1                (D - CA^-1B)^-1      ]
  //
  // Therefore
  //
  // [A [0]]^-1 = [A^-1       [0]]
  // [C  1 ]      [ -CA^-1     1 ]
  function inverse(m) {
    var iDet = 1 / determinant(m);
    var a = m[0][0], b = m[0][1], c = m[0][2];
    var d = m[1][0], e = m[1][1], f = m[1][2];
    var g = m[2][0], h = m[2][1], k = m[2][2];
    var Ainv = [[(e*k - f*h) * iDet, (c*h - b*k) * iDet, (b*f - c*e) * iDet, 0],
                [(f*g - d*k) * iDet, (a*k - c*g) * iDet, (c*d - a*f) * iDet, 0],
                [(d*h - e*g) * iDet, (g*b - a*h) * iDet, (a*e - b*d) * iDet, 0]
               ];
    var lastRow = []
    for (var i = 0; i < 3; i++) {
      var val = 0;
      for (var j = 0; j < 3; j++) {
        val += m[3][j] * Ainv[j][i];
      }
      lastRow.push(val);
    }
    lastRow.push(1);
    Ainv.push(lastRow);
    return Ainv;
  }

  function transposeMatrix4(m) {
    return [[m[0][0], m[1][0], m[2][0], m[3][0]],
            [m[0][1], m[1][1], m[2][1], m[3][1]],
            [m[0][2], m[1][2], m[2][2], m[3][2]],
            [m[0][3], m[1][3], m[2][3], m[3][3]]];
  }

  function multVecMatrix(v, m) {
    var result = [];
    for (var i = 0; i < 4; i++) {
      var val = 0;
      for (var j = 0; j < 4; j++) {
        val += v[j] * m[j][i];
      }
      result.push(val);
    }
    return result;
  }

  function normalize(v) {
    var len = length(v);
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function length(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  function combine(v1, v2, v1s, v2s) {
    return [v1s * v1[0] + v2s * v2[0], v1s * v1[1] + v2s * v2[1], 
            v1s * v1[2] + v2s * v2[2]];
  }

  function cross(v1, v2) {
    return [v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]];
  }

  function decomposeMatrix(matrix) {
    var m3d = [[matrix[0], matrix[1], 0, 0],
               [matrix[2], matrix[3], 0, 0],
               [0,         0,         1, 0],
               [matrix[4], matrix[5], 0, 1]];

    // skip normalization step as m3d[3][3] should always be 1
    if (m3d[3][3] != 1) {
      throw 'attempt to decompose non-normalized matrix';
    }

    var perspectiveMatrix = m3d.concat(); // copy m3d
    for (var i = 0; i < 3; i++)
      perspectiveMatrix[i][3] = 0;

    if (determinant(perspectiveMatrix) == 0)
      return false;

    var rhs = [];

    if (m3d[0][3] != 0 || m3d[1][3] != 0 || m3d[2][3] != 0) {
      rhs.push(m3d[0][3]);
      rhs.push(m3d[1][3]);
      rhs.push(m3d[2][3]);
      rhs.push(m3d[3][3]);

      var inversePerspectiveMatrix = inverse(perspectiveMatrix);
      var transposedInversePerspectiveMatrix =
          transposeMatrix4(inversePerspectiveMatrix);
      var perspective = multVecMatrix(rhs, transposedInversePerspectiveMatrix);
    } else {
      var perspective = [0, 0, 0, 1];
    }

    var translate = m3d[3].slice(0, 3);

    var row = [];
    row.push(m3d[0].slice(0, 3));
    var scale = [];
    scale.push(length(row[0]));
    row[0] = normalize(row[0]);

    var skew = [];
    row.push(m3d[1].slice(0, 3));
    skew.push(dot(row[0], row[1]));
    row[1] = combine(row[1], row[0], 1.0, -skew[0]);

    scale.push(length(row[1]));
    row[1] = normalize(row[1]);
    skew[0] /= scale[1];

    row.push(m3d[2].slice(0, 3));
    skew.push(dot(row[0], row[2]));
    row[2] = combine(row[2], row[0], 1.0, -skew[1]);
    skew.push(dot(row[1], row[2]));
    row[2] = combine(row[2], row[1], 1.0, -skew[2]);

    scale.push(length(row[2]));
    row[2] = normalize(row[2]);
    skew[1] /= scale[2];
    skew[2] /= scale[2];

    var pdum3 = cross(row[1], row[2]);
    if (dot(row[0], pdum3) < 0) {
      for (var i = 0; i < 3; i++) {
        scale[0] *= -1;
        row[i][0] *= -1;
        row[i][1] *= -1;
        row[i][2] *= -1;
      }
    } 
    
    var quaternion = [
      0.5 * Math.sqrt(Math.max(1 + row[0][0] - row[1][1] - row[2][2], 0)),
      0.5 * Math.sqrt(Math.max(1 - row[0][0] + row[1][1] - row[2][2], 0)),
      0.5 * Math.sqrt(Math.max(1 - row[0][0] - row[1][1] + row[2][2], 0)),
      0.5 * Math.sqrt(Math.max(1 + row[0][0] + row[1][1] + row[2][2], 0))
    ];

    if (row[2][1] > row[1][2])
      quaternion[0] = -quaternion[0];
    if (row[0][2] > row[2][0])
      quaternion[1] = -quaternion[1];
    if (row[1][0] > row[0][1])
      quaternion[2] = -quaternion[2];

    return {translate: translate, scale: scale, skew: skew, 
            quaternion: quaternion, perspective: perspective};
  }
  return decomposeMatrix;
}();

function dot(v1, v2) {
  var result = 0;
  for (var i = 0; i < v1.length; i++) {
    result += v1[i] * v2[i];
  }
  return result;
}

function multiplyMatrices(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
          a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
          a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function convertItemToMatrix(item) {
  switch(item.t) {
    case 'rotate':
      var amount = item.d * Math.PI / 180;
      return [Math.cos(amount), Math.sin(amount), 
              -Math.sin(amount), Math.cos(amount), 0, 0];
    case 'scale':
      return [item.d[0], 0, 0, item.d[1], 0, 0];
    // TODO: Work out what to do with non-px values.
    case 'translate':
      return [1, 0, 0, 1, item.d[0].px, item.d[1].px];
    case 'matrix':
      return item.d;
  }
}

function convertToMatrix(transformList) {
  return transformList.map(convertItemToMatrix).reduce(multiplyMatrices);
}

var composeMatrix = function() {
  function multiply(a, b) {
    var result = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        for (var k = 0; k < 4; k++) {
          result[i][j] += b[i][k] * a[k][j];
        }
      }
    }
    return result;
  }

  function composeMatrix(translate, scale, skew, quat, perspective) {
    var matrix = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

    for (var i = 0; i < 4; i++) {
      matrix[i][3] = perspective[i];
    }

    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        matrix[3][i] += translate[j] * matrix[j][i];
      }
    }

    var x = quat[0], y = quat[1], z = quat[2], w = quat[3];
    
    var rotMatrix = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

    rotMatrix[0][0] = 1 - 2 * (y * y + z * z);
    rotMatrix[0][1] = 2 * (x * y - z * w);
    rotMatrix[0][2] = 2 * (x * z + y * w);
    rotMatrix[1][0] = 2 * (x * y + z * w);
    rotMatrix[1][1] = 1 - 2 * (x * x + z * z);
    rotMatrix[1][2] = 2 * (y * z - x * w);
    rotMatrix[2][0] = 2 * (x * z - y * w);
    rotMatrix[2][1] = 2 * (y * z + x * w);
    rotMatrix[2][2] = 1 - 2 * (x * x + y * y);

    matrix = multiply(matrix, rotMatrix);

    var temp = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    if (skew[2]) {
      temp[2][1] = skew[2];
      matrix = multiply(matrix, temp);
    }

    if (skew[1]) {
      temp[2][1] = 0;
      temp[2][0] = skew[0];
      matrix = multiply(matrix, temp);
    }

    for (i = 0; i < 3; i++) {
      for (j = 0; j < 3; j++) {
        matrix[i][j] *= scale[i];
      }
    }

    return {t: 'matrix', d: [matrix[0][0], matrix[0][1],
                             matrix[1][0], matrix[1][1],
                             matrix[3][0], matrix[3][1]]};
  }
  return composeMatrix;
}();

function interpolateTransformsWithMatrices(from, to, f) {
  var fromM = decomposeMatrix(convertToMatrix(from));
  var toM = decomposeMatrix(convertToMatrix(to));

  var product = dot(fromM.quaternion, toM.quaternion);
  product = clamp(product, -1.0, 1.0);
  if (product == 1.0) {
    var quat = fromM.quaternion;
  } else {
    var theta = Math.acos(product);
    var w = Math.sin(f * theta) * 1 / Math.sqrt(1 - product * product);

    var quat = [];
    for (var i = 0; i < 4; i++) {
      quat.push(fromM.quaternion[i] * (Math.cos(f * theta) - product * w) +
                toM.quaternion[i] * w);
    }
  }

  var translate = interp(fromM.translate, toM.translate, f);
  var scale = interp(fromM.scale, toM.scale, f);
  var skew = interp(fromM.skew, toM.skew, f);
  var perspective = interp(fromM.perspective, toM.perspective, f);

  return composeMatrix(translate, scale, skew, quat, perspective);
}

function interpTransformValue(from, to, f) {
  var type = from.t ? from.t : to.t;
  switch(type) {
    // Transforms with unitless parameters.
    case 'rotate':
    case 'rotateX':
    case 'rotateY':
    case 'rotateZ':
    case 'scale':
    case 'scaleX':
    case 'scaleY':
    case 'scaleZ':
    case 'scale3d':
    case 'skew':
    case 'skewX':
    case 'skewY':
    case 'matrix':
      return {t: type, d:interp(from.d, to.d, f, type)};
      break;
    default:
      // Transforms with lengthType parameters.
      var result = [];
      if (from.d && to.d) {
        var maxVal = Math.max(from.d.length, to.d.length);
      } else if (from.d) {
        var maxVal = from.d.length;
      }  else {
        var maxVal = to.d.length;
      }
      for (var j = 0; j < maxVal; j++) {
        var fromVal = from.d ? from.d[j] : {};
        var toVal = to.d ? to.d[j] : {};
        result.push(lengthType.interpolate(fromVal, toVal, f));
      }
      return {t: type, d: result};
      break;
  }
}

// The CSSWG decided to disallow scientific notation in CSS property strings 
// (see http://lists.w3.org/Archives/Public/www-style/2010Feb/0050.html).
// We need this function to hakonitize all numbers before adding them to
// property strings.
// TODO: Apply this function to all property strings 
function n(num) {
  return Number(num).toFixed(4);
}

var transformType = {
  add: function(base, delta) { return base.concat(delta); },
  interpolate: function(from, to, f) {
    var out = []
    for (var i = 0; i < Math.min(from.length, to.length); i++) {
      if (from[i].t != to[i].t) {
        break;
      }
      out.push(interpTransformValue(from[i], to[i], f));
    }

    if (i < Math.min(from.length, to.length)) {
      out.push(interpolateTransformsWithMatrices(from.slice(i), to.slice(i), 
          f));
      return out;
    }

    for (; i < from.length; i++)
      out.push(interpTransformValue(from[i], {t: null, d: null}, f));

    for (; i < to.length; i++)
      out.push(interpTransformValue({t: null, d: null}, to[i], f));
    return out;
  },
  toCssValue: function(value, svgMode) {
    // TODO: fix this :)
    var out = ''
    for (var i = 0; i < value.length; i++) {
      console.assert(value[i].t, 'transform type should be resolved by now');
      switch (value[i].t) {
        case 'rotate':
        case 'rotateX':
        case 'rotateY':
        case 'rotateZ':
        case 'skewX':
        case 'skewY':
          var unit = svgMode ? '' : 'deg';
          out += value[i].t + '(' + value[i].d + unit + ') ';
          break;
        case 'skew':
          var unit = svgMode ? '' : 'deg';
          out += value[i].t + '(' + value[i].d[0] + unit;
          if (value[i].d[1] === 0) {
            out += ') ';
          } else {
            out += ', ' + value[i].d[1] + unit + ') ';
          }
          break;
        case 'translateX':
        case 'translateY':
        case 'translateZ':
        case 'perspective':
          out += value[i].t + '(' + lengthType.toCssValue(value[i].d[0])
              + ') ';
          break;
        case 'translate':
          if (svgMode) {
            if (value[i].d[1] === undefined) {
              out += value[i].t + '(' + value[i].d[0]['px'] + ') ';
            } else {
              out += value[i].t + '(' + value[i].d[0]['px'] + ', ' +
                    value[i].d[1]['px'] + ') ';
            }
            break;
          }
          if (value[i].d[1] === undefined) {
            out += value[i].t + '(' + lengthType.toCssValue(value[i].d[0])
                + ') ';
          } else {
            out += value[i].t + '(' + lengthType.toCssValue(value[i].d[0])
                + ', ' + lengthType.toCssValue(value[i].d[1]) + ') ';
          }
          break;
        case 'translate3d':
          var values = value[i].d.map(lengthType.toCssValue);
          out += value[i].t + '(' + values[0] + ', ' + values[1] +
              ', ' + values[2] + ') ';
          break;
        case 'scale':
          if (value[i].d[0] === value[i].d[1]) {
            out += value[i].t + '(' + value[i].d[0] + ') ';
          } else {
            out += value[i].t + '(' + value[i].d[0] + ', ' + value[i].d[1] +
                ') ';
          }
          break;
        case 'scaleX':
        case 'scaleY':
        case 'scaleZ':
          out += value[i].t + '(' + value[i].d[0] + ') ';
          break;
        case 'scale3d':
          out += value[i].t + '(' + value[i].d[0] + ', ' +
              value[i].d[1] + ', ' + value[i].d[2] + ') ';
          break;
        case 'matrix':
          out += value[i].t + '(' + n(value[i].d[0]) + ', ' + n(value[i].d[1])
              + ', ' + n(value[i].d[2]) + ', ' + n(value[i].d[3]) + ', ' + 
              n(value[i].d[4]) + ', ' + n(value[i].d[5]) + ') ';
          break;
      }
    }
    return out.substring(0, out.length - 1);
  },
  fromCssValue: function(value) {
    // TODO: fix this :)
    if (value === undefined) {
      return undefined;
    }
    var result = []
    while (value.length > 0) {
      var r = undefined;
      for (var i = 0; i < transformREs.length; i++) {
        var reSpec = transformREs[i];
        r = reSpec[0].exec(value);
        if (r) {
          result.push({t: reSpec[2], d: reSpec[1](r)});
          value = value.substring(r[0].length);
          break;
        }
      }
      if (!isDefinedAndNotNull(r))
        return result;
    }
    return result;
  }
};

var propertyTypes = {
  'backgroundColor': colorType,
  'backgroundPosition': percentLengthType,
  'borderBottomColor': colorType,
  'borderBottomWidth': lengthType,
  'borderLeftColor': colorType,
  'borderLeftWidth': lengthType,
  'borderRightColor': colorType,
  'borderRightWidth': lengthType,
  'borderSpacing': lengthType,
  'borderTopColor': colorType,
  'borderTopWidth': lengthType,
  'bottom': percentLengthType,
  'clip': rectangleType,
  'color': colorType,
  'crop': rectangleType,
  'cx': lengthType,
  'fontSize': percentLengthType,
  'fontWeight': fontWeightType,
  'height': percentLengthType,
  'left': percentLengthType,
  'letterSpacing': lengthType,
  // TODO: should be both number and percentLength
  'lineHeight': percentLengthType,
  'marginBottom': lengthType,
  'marginLeft': lengthType,
  'marginRight': lengthType,
  'marginTop': lengthType,
  'maxHeight': percentLengthType,
  'maxWidth': percentLengthType,
  'minHeight': percentLengthType,
  'minWidth': percentLengthType,
  'opacity': numberType,
  'outlineColor': colorType,
  // TODO: not clear why this is an integer in the transitions spec
  'outlineOffset': integerType,
  'outlineWidth': lengthType,
  'paddingBottom': lengthType,
  'paddingLeft': lengthType,
  'paddingRight': lengthType,
  'paddingTop': lengthType,
  'right': percentLengthType,
  'textIndent': percentLengthType,
  'textShadow': shadowType,
  'top': percentLengthType,
  'transform': transformType,
  'verticalAlign': percentLengthType,
  'visibility': visibilityType,
  'width': percentLengthType,
  'wordSpacing': percentLengthType,
  'x': lengthType,
  'y': lengthType,
  'zIndex': integerType,
};

var svgProperties = {
  'cx': 1,
  'width': 1,
  'x': 1,
  'y': 1,
};


var propertyIsSVGAttrib = function(property, target) {
  return target.namespaceURI == 'http://www.w3.org/2000/svg' &&
      property in svgProperties;
};

var getType = function(property) {
  return propertyTypes[property] || nonNumericType;
}

var add = function(property, base, delta) {
  if (delta === rawNeutralValue) {
    return base;
  }
  return getType(property).add(base, delta);
}

/**
 * Interpolate the given property name (f*100)% of the way from 'from' to 'to'.
 * 'from' and 'to' are both raw values already converted from CSS value
 * strings. Requires the target element to be able to determine whether the
 * given property is an SVG attribute or not, as this impacts the conversion of
 * the interpolated value back into a CSS value string for transform
 * translations.
 *
 * e.g. interpolate('transform', elem, 'rotate(40deg)', 'rotate(50deg)', 0.3);
 *   will return 'rotate(43deg)'.
 */
var interpolate = function(property, from, to, f) {
  console.assert(isDefinedAndNotNull(from) && isDefinedAndNotNull(to),
      'Both to and from values should be specified for interpolation');
  return getType(property).interpolate(from, to, f);
}

/**
 * Convert the provided interpolable value for the provided property to a CSS
 * value string. Note that SVG transforms do not require units for translate
 * or rotate values while CSS properties require 'px' or 'deg' units.
 */
var toCssValue = function(property, value, svgMode) {
  return getType(property).toCssValue(value, svgMode);
}

var fromCssValue = function(property, value) {
  if (value === cssNeutralValue) {
    return rawNeutralValue;
  }
  // Currently we'll hit this assert if input to the API is bad. To avoid this,
  // we should eliminate invalid values when normalizing the list of keyframes.
  // See the TODO in isSupportedPropertyValue().
  var result = getType(property).fromCssValue(value);
  console.assert(isDefinedAndNotNull(result),
      'Invalid property value "' + value + '" for property "' + property + '"');
  return result;
}

// Sentinel values
var cssNeutralValue = {};
var rawNeutralValue = {};

/** @constructor */
var CompositableValue = function() {
};

CompositableValue.prototype = {
  compositeOnto: abstractMethod,
  // This is purely an optimization.
  dependsOnUnderlyingValue: function() {
    return true;
  },
};


/** @constructor */
var AddReplaceCompositableValue = function(value, composite) {
  this.value = value;
  this.composite = composite;
  console.assert(
      !(this.value === cssNeutralValue && this.composite === 'replace'),
      'Should never replace-composite the neutral value');
};

AddReplaceCompositableValue.prototype =
    createObject(CompositableValue.prototype, {
  compositeOnto: function(property, underlyingValue) {
    switch (this.composite) {
      case 'replace':
        return this.value;
      case 'add':
        return add(property, underlyingValue, this.value);
      default:
        console.assert(false, 'Invalid composite operation ' + this.composite);
    }
  },
  dependsOnUnderlyingValue: function() {
    return this.composite === 'add';
  },
});


/** @constructor */
var BlendedCompositableValue = function(beforeValue, afterValue, fraction) {
  this.beforeValue = beforeValue;
  this.afterValue = afterValue;
  this.fraction = fraction;
};

BlendedCompositableValue.prototype =
    createObject(CompositableValue.prototype, {
  compositeOnto: function(property, underlyingValue) {
    return interpolate(property,
        this.beforeValue.compositeOnto(property, underlyingValue),
        this.afterValue.compositeOnto(property, underlyingValue),
        this.fraction);
  },
  dependsOnUnderlyingValue: function() {
    return this.beforeValue.dependsOnUnderlyingValue() ||
        this.afterValue.dependsOnUnderlyingValue();
  },
});


/** @constructor */
var AccumulatedCompositableValue = function(bottomValue, accumulatingValue,
    accumulationCount) {
  this.bottomValue = bottomValue;
  this.accumulatingValue = accumulatingValue;
  this.accumulationCount = accumulationCount;
  console.assert(this.accumulationCount > 0,
      'Accumumlation count should be strictly positive');
};

AccumulatedCompositableValue.prototype =
    createObject(CompositableValue.prototype, {
  compositeOnto: function(property, underlyingValue) {
    // The spec defines accumulation recursively, but we do it iteratively to
    // better handle large numbers of iterations.
    var result = this.bottomValue.compositeOnto(property, underlyingValue);
    for (var i = 0; i < this.accumulationCount; i++) {
      result = this.accumulatingValue.compositeOnto(property, result);
    }
    return result;
  },
  dependsOnUnderlyingValue: function() {
    return this.bottomValue.dependsOnUnderlyingValue() &&
        this.accumulatingValue.dependsOnUnderlyingValue();
  },
});


/** @constructor */
var CompositedPropertyMap = function(target) {
  this.properties = {};
  this.target = target;
};

CompositedPropertyMap.prototype = {
  addValue: function(property, animValue) {
    if (!(property in this.properties)) {
      this.properties[property] = [];
    }
    if (!(animValue instanceof CompositableValue)) {
      throw new TypeError('expected CompositableValue');
    }
    this.properties[property].push(animValue);
  },
  applyAnimatedValues: function() {
    for (var property in this.properties) {
      var valuesToComposite = this.properties[property];
      if (valuesToComposite.length === 0) {
        // property has previously been set but no value was accumulated
        // in this animation iteration. Reset value and stop tracking.
        clearValue(this.target, property);
        delete this.properties[property];
        continue;
      }
      var i = valuesToComposite.length - 1;
      for ( ; i >= 0; i--) {
        if (!valuesToComposite[i].dependsOnUnderlyingValue()) {
          break;
        }
      }
      // the baseValue will either be retrieved after clearing the value or
      // will be overwritten by a 'replace'.
      var baseValue = undefined;
      if (i === -1) {
        clearValue(this.target, property);
        baseValue = fromCssValue(property, getValue(this.target, property));
        // TODO: Decide what to do with elements not in the DOM.
        console.assert(isDefinedAndNotNull(baseValue) && baseValue !== '',
            'Base value should always be set. ' +
            'Is the target element in the DOM?');
        i = 0;
      }
      for ( ; i < valuesToComposite.length; i++) {
        baseValue = valuesToComposite[i].compositeOnto(property, baseValue);
      }
      console.assert(isDefinedAndNotNull(baseValue) && baseValue !== '',
          'Value should always be set after compositing');
      var isSvgMode = propertyIsSVGAttrib(property, this.target);
      setValue(this.target, property, toCssValue(property, baseValue,
          isSvgMode));
      this.properties[property] = [];
    }
  },
};

/** @constructor */
var Compositor = function() {
  this.targets = []
};

Compositor.prototype = {
  setAnimatedValue: function(target, property, animValue) {
    if (target !== null) {
      if (target._anim_properties === undefined) {
        target._anim_properties = new CompositedPropertyMap(target);
        this.targets.push(target);
      }
      target._anim_properties.addValue(property, animValue);
    }
  },
  applyAnimatedValues: function() {
    for (var i = 0; i < this.targets.length; i++) {
      var target = this.targets[i];
      target._anim_properties.applyAnimatedValues();
    }
  }
};

var initializeIfSVGAndUninitialized = function(property, target) {
  if (propertyIsSVGAttrib(property, target)) {
    if (!isDefinedAndNotNull(target._actuals)) {
      target._actuals = {};
      target._bases = {};
      target.actuals = {};
      target._getAttribute = target.getAttribute;
      target._setAttribute = target.setAttribute;
      target.getAttribute = function(name) {
        if (isDefinedAndNotNull(target._bases[name])) {
          return target._bases[name];
        }
        return target._getAttribute(name);
      };
      target.setAttribute = function(name, value) {
        if (isDefinedAndNotNull(target._actuals[name])) {
          target._bases[name] = value;
        } else {
          target._setAttribute(name, value);
        }
      };
    }
    if(!isDefinedAndNotNull(target._actuals[property])) {
      var baseVal = target.getAttribute(property);
      target._actuals[property] = 0;
      target._bases[property] = baseVal;

      Object.defineProperty(target.actuals, property, configureDescriptor({
        set: function(value) {
          if (value == null) {
            target._actuals[property] = target._bases[property];
            target._setAttribute(property, target._bases[property]);
          } else {
            target._actuals[property] = value;
            target._setAttribute(property, value)
          }
        },
        get: function() {
          return target._actuals[property];
        },
      }));
    }
  }
}

var setValue = function(target, property, value) {
  initializeIfSVGAndUninitialized(property, target);
  if (property === "transform") {
    property = features.transformProperty;
  }
  if (propertyIsSVGAttrib(property, target)) {
    target.actuals[property] = value;
  } else {
    target.style[property] = value;
  }
}

var clearValue = function(target, property) {
  initializeIfSVGAndUninitialized(property, target);
  if (property == "transform") {
    property = features.transformProperty;
  }
  if (propertyIsSVGAttrib(property, target)) {
    target.actuals[property] = null;
  } else {
    target.style[property] = null;
  }
}

var getValue = function(target, property) {
  initializeIfSVGAndUninitialized(property, target);
  if (property == "transform") {
    property = features.transformProperty;
  }
  if (propertyIsSVGAttrib(property, target)) {
    return target.actuals[property];
  } else {
    return getComputedStyle(target)[property];
  }
}

var rafScheduled = false;

var compositor = new Compositor();

// ECMA Script does not guarantee stable sort.
var stableSort = function(array, compare) {
  var indicesAndValues = array.map(function(value, index) {
    return { index: index, value: value };
  });
  indicesAndValues.sort(function(a, b) {
    var r = compare(a.value, b.value);
    return r == 0 ? a.index - b.index : r;
  });
  array.length = 0;
  array.push.apply(array, indicesAndValues.map(function(value) {
    return value.value;
  }));
};

var usePerformanceTiming =
    typeof performance === "object" &&
    typeof performance.timing === "object" &&
    typeof performance.now === "function";

// Don't use a local named requestAnimationFrame, to avoid potential problems
// with hoisting.
var raf = window.requestAnimationFrame;
if (!raf) {
  var nativeRaf =  window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame;
  if (!nativeRaf) {
    // requestAnimationFrame is not available, simulate it.
    raf = function(callback) {
      setTimeout(function() {
        callback(clockMillis());
      }, 1000/60);
    };
  } else if (usePerformanceTiming) {
    // platform requestAnimationFrame provides only millisecond accuracy, wrap
    // it and use performance.now()
    raf = function(callback) {
      nativeRaf(function() {
        callback(performance.now());
      });
    };
  } else {
    // platform requestAnimationFrame provides only millisecond accuracy, and
    // we can't do any better
    raf = nativeRaf;
  }
}

var clockMillis = function() {
  return usePerformanceTiming ? performance.now() : Date.now();
};
// Set up the zero times for document time. Document time is relative to the
// document load event.
var documentTimeZeroAsRafTime = undefined;
var documentTimeZeroAsClockTime = undefined;
if (usePerformanceTiming) {
  var load = function() {
    // RAF time is relative to the navigationStart event.
    documentTimeZeroAsRafTime =
        performance.timing.loadEventStart - performance.timing.navigationStart;
    // performance.now() uses the same origin as RAF time.
    documentTimeZeroAsClockTime = documentTimeZeroAsRafTime;
  };
} else {
  // The best approximation we have for the relevant clock and RAF times is to
  // listen to the load event.
  load = function() {
    raf(function(rafTime) {
      documentTimeZeroAsRafTime = rafTime;
    });
    documentTimeZeroAsClockTime = Date.now();
  };
}
// Start timing when load event fires or if this script is processed when
// document loading is already complete.
if (document.readyState == 'complete') {
  // When performance timing is unavailable and this script is loaded
  // dynamically, document zero time is incorrect.
  // Warn the user in this case.
  if (!usePerformanceTiming) {
    console.warn('Web animations can\'t discover document zero time when ' +
      'asynchronously loaded in the absence of performance timing.');
  }
  load();
} else {
  addEventListener('load', function() {
    load();
    if (usePerformanceTiming) {
      // We use setTimeout() to clear cachedClockTimeMillis at the end of a
      // frame, but this will not run until after other load handlers. We need
      // those handlers to pick up the new value of clockMillis(), so we must
      // clear the cached value.
      cachedClockTimeMillis = undefined;
    }
  });
}

// A cached document time for use during the current callstack.
var cachedClockTimeMillis = undefined;
// Calculates one time relative to another, returning null if the zero time is
// undefined.
var relativeTime = function(time, zeroTime) {
  return isDefined(zeroTime) ? time - zeroTime : null;
}

var cachedClockTime = function() {
  // Cache a document time for the remainder of this callstack.
  if (!isDefined(cachedClockTimeMillis)) {
    cachedClockTimeMillis = clockMillis();
    setTimeout(function() { cachedClockTimeMillis = undefined; }, 0);
  }
  return cachedClockTimeMillis / 1000;
};


// These functions should be called in every stack that could possibly modify
// the effect results that have already been calculated for the current tick.
var modifyCurrentAnimationStateDepth = 0;
var enterModifyCurrentAnimationState = function() {
  modifyCurrentAnimationStateDepth++;
};
var exitModifyCurrentAnimationState = function(shouldRepeat) {
  modifyCurrentAnimationStateDepth--;
  // shouldRepeat is set false when we know we can't possibly affect the current
  // state (eg. a TimedItem which is not attached to a player). We track the
  // depth of recursive calls trigger just one repeat per entry. Only the value
  // of shouldRepeat from the outermost call is considered, this allows certain
  // locatations (eg. constructors) to override nested calls that would
  // otherwise set shouldRepeat unconditionally.
  if (modifyCurrentAnimationStateDepth == 0 && shouldRepeat) {
    repeatLastTick();
  }
};

var repeatLastTick = function() {
  if (isDefined(lastTickTime)) {
    ticker(lastTickTime, true);
  }
};

var lastTickTime;
var ticker = function(rafTime, isRepeat) {
  // Don't tick till the page is loaded....
  if (!isDefined(documentTimeZeroAsRafTime)) {
    raf(ticker);
    return;
  }

  if (!isRepeat) {
    lastTickTime = rafTime;
    cachedClockTimeMillis = rafTime;
  }

  // Get animations for this sample. We order first by Player start time, and
  // second by DFS order within each Player's tree.
  var sortedPlayers = PLAYERS;
  stableSort(sortedPlayers, function(a, b) {
    return a.startTime - b.startTime;
  });
  var finished = true;
  var paused = true;
  var animations = [];
  sortedPlayers.forEach(function(player) {
    player._hasTicked = true;
    player._update();
    finished = finished && player._isPastEndOfActiveInterval();
    paused = paused && player.paused;
    player._getLeafItemsInEffect(animations);
  });

  // Apply animations in order
  for (var i = 0; i < animations.length; i++) {
    if (animations[i] instanceof Animation) {
      animations[i]._sample();
    }
  }

  // Generate events
  sortedPlayers.forEach(function(player) {
    player._generateEvents();
  });

  // Composite animated values into element styles
  compositor.applyAnimatedValues();

  if (!isRepeat) {
    if (finished || paused) {
      rafScheduled = false;
    } else {
      raf(ticker);
    }
    cachedClockTimeMillis = undefined;
  }
};

// Multiplication where zero multiplied by any value (including infinity)
// gives zero.
var multiplyZeroGivesZero = function(a, b) {
  return (a === 0 || b === 0) ? 0 : a * b;
};

var maybeRestartAnimation = function() {
  if (rafScheduled) {
    return;
  }
  raf(ticker);
  rafScheduled = true;
};

var DOCUMENT_TIMELINE = new Timeline(constructorToken);
document.timeline = DOCUMENT_TIMELINE;

window.Element.prototype.animate = function(effect, timing) {
  var anim = new Animation(this, effect, timing);
  DOCUMENT_TIMELINE.play(anim);
  return anim;
};
window.Element.prototype.getCurrentPlayers = function() {
  return PLAYERS.filter((function(player) {
    return player._isCurrent() && player._isTargetingElement(this);
  }).bind(this));
};
window.Element.prototype.getCurrentAnimations = function() {
  var animations = [];
  PLAYERS.forEach((function(player) {
    if (player._isCurrent()) {
      player._getAnimationsTargetingElement(this, animations);
    }
  }).bind(this));
  return animations;
};

window.Animation = Animation;
window.AnimationEffect = AnimationEffect;
window.KeyframeAnimationEffect = KeyframeAnimationEffect;
window.MediaReference = MediaReference;
window.ParGroup = ParGroup;
window.PathAnimationEffect = PathAnimationEffect;
window.Player = Player;
window.PseudoElementReference = PseudoElementReference;
window.SeqGroup = SeqGroup;
window.TimedItem = TimedItem;
window.TimedItemList = TimedItemList;
window.Timing = Timing;
window.Timeline = Timeline;
window.TimingEvent = TimingEvent;
window.TimingGroup = TimingGroup;

window._WebAnimationsTestingUtilities = { _constructorToken : constructorToken }

})();
