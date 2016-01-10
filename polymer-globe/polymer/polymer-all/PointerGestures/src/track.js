/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This event denotes the beginning of a series of tracking events.
 *
 * @for Events
 * @event trackstart
 * @param {Number} dx Pixels moved in the x direction since trackstart.
 * @param {Number} dy Pixes moved in the y direction since trackstart.
 * @param {Number} ddx Pixels moved in the x direction since the last track.
 * @param {Number} ddy Pixles moved in the y direction since the last track.
 * @param {Number} clientX The clientX position of the track gesture.
 * @param {Number} clientY The clientY position of the track gesture.
 * @param {Number} pageX The pageX position of the track gesture.
 * @param {Number} pageY The pageY position of the track gesture.
 * @param {Number} screenX The screenX position of the track gesture.
 * @param {Number} screenY The screenY position of the track gesture.
 * @param {Number} xDirection The last x axis direction of the pointer.
 * @param {Number} yDirection The last y axis direction of the pointer.
 * @param {Object} trackInfo A shared object between all tracking events.
 * @param {String} pointerType The type of pointer that make the track gesture.
 */
/**
 *
 * This event fires for all pointer movement being tracked.
 *
 * @for Events
 * @event track
 * @param {Number} dx Pixels moved in the x direction since trackstart.
 * @param {Number} dy Pixes moved in the y direction since trackstart.
 * @param {Number} ddx Pixels moved in the x direction since the last track.
 * @param {Number} ddy Pixles moved in the y direction since the last track.
 * @param {Number} clientX The clientX position of the track gesture.
 * @param {Number} clientY The clientY position of the track gesture.
 * @param {Number} pageX The pageX position of the track gesture.
 * @param {Number} pageY The pageY position of the track gesture.
 * @param {Number} screenX The screenX position of the track gesture.
 * @param {Number} screenY The screenY position of the track gesture.
 * @param {Number} xDirection The last x axis direction of the pointer.
 * @param {Number} yDirection The last y axis direction of the pointer.
 * @param {Object} trackInfo A shared object between all tracking events.
 * @param {String} pointerType The type of pointer that make the track gesture.
 */
/**
 * This event fires when the pointer is no longer being tracked.
 *
 * @for Events
 * @event trackend
 * @param {Number} dx Pixels moved in the x direction since trackstart.
 * @param {Number} dy Pixes moved in the y direction since trackstart.
 * @param {Number} ddx Pixels moved in the x direction since the last track.
 * @param {Number} ddy Pixles moved in the y direction since the last track.
 * @param {Number} clientX The clientX position of the track gesture.
 * @param {Number} clientY The clientY position of the track gesture.
 * @param {Number} pageX The pageX position of the track gesture.
 * @param {Number} pageY The pageY position of the track gesture.
 * @param {Number} screenX The screenX position of the track gesture.
 * @param {Number} screenY The screenY position of the track gesture.
 * @param {Number} xDirection The last x axis direction of the pointer.
 * @param {Number} yDirection The last y axis direction of the pointer.
 * @param {Object} trackInfo A shared object between all tracking events.
 * @param {String} pointerType The type of pointer that make the track gesture.
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = new scope.PointerMap;
  var track = {
    events: [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel'
    ],
    WIGGLE_THRESHOLD: 4,
    clampDir: function(inDelta) {
      return inDelta > 0 ? 1 : -1;
    },
    calcPositionDelta: function(inA, inB) {
      var x = 0, y = 0;
      if (inA && inB) {
        x = inB.pageX - inA.pageX;
        y = inB.pageY - inA.pageY;
      }
      return {x: x, y: y};
    },
    fireTrack: function(inType, inEvent, inTrackingData) {
      var t = inTrackingData;
      var d = this.calcPositionDelta(t.downEvent, inEvent);
      var dd = this.calcPositionDelta(t.lastMoveEvent, inEvent);
      if (dd.x) {
        t.xDirection = this.clampDir(dd.x);
      }
      if (dd.y) {
        t.yDirection = this.clampDir(dd.y);
      }
      var trackData = {
        dx: d.x,
        dy: d.y,
        ddx: dd.x,
        ddy: dd.y,
        clientX: inEvent.clientX,
        clientY: inEvent.clientY,
        pageX: inEvent.pageX,
        pageY: inEvent.pageY,
        screenX: inEvent.screenX,
        screenY: inEvent.screenY,
        xDirection: t.xDirection,
        yDirection: t.yDirection,
        trackInfo: t.trackInfo,
        pointerType: inEvent.pointerType
      };
      if (inType === 'trackend') {
        // TODO(dfreedman): this will leak shadowdom targets, replace with a
        // more sophisticated mechanism
        trackData._releaseTarget = inEvent.target;
      }
      var e = dispatcher.makeEvent(inType, trackData);
      t.lastMoveEvent = inEvent;
      dispatcher.dispatchEvent(e, t.downTarget);
    },
    pointerdown: function(inEvent) {
      if (inEvent.isPrimary && (inEvent.pointerType === 'mouse' ? inEvent.buttons === 1 : true)) {
        var p = {
          downEvent: inEvent,
          downTarget: inEvent.target,
          trackInfo: {},
          lastMoveEvent: null,
          xDirection: 0,
          yDirection: 0,
          tracking: false
        };
        pointermap.set(inEvent.pointerId, p);
      }
    },
    pointermove: function(inEvent) {
      var p = pointermap.get(inEvent.pointerId);
      if (p) {
        if (!p.tracking) {
          var d = this.calcPositionDelta(p.downEvent, inEvent);
          var move = d.x * d.x + d.y * d.y;
          // start tracking only if finger moves more than WIGGLE_THRESHOLD
          if (move > this.WIGGLE_THRESHOLD) {
            p.tracking = true;
            this.fireTrack('trackstart', p.downEvent, p);
            this.fireTrack('track', inEvent, p);
          }
        } else {
          this.fireTrack('track', inEvent, p);
        }
      }
    },
    pointerup: function(inEvent) {
      var p = pointermap.get(inEvent.pointerId);
      if (p) {
        if (p.tracking) {
          this.fireTrack('trackend', inEvent, p);
        }
        pointermap.delete(inEvent.pointerId);
      }
    },
    pointercancel: function(inEvent) {
      this.pointerup(inEvent);
    }
  };
  dispatcher.registerRecognizer('track', track);
})(window.PointerGestures);
