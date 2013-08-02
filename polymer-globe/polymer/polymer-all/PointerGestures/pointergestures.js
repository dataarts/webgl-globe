/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
/**
 * @module PointerGestures
 */
(function() {
  var thisFile = 'pointergestures.js';
  var scopeName = 'PointerGestures';
  var modules = [
    'src/PointerGestureEvent.js',
    'src/initialize.js',
    'src/sidetable.js',
    'src/pointermap.js',
    'src/dispatcher.js',
    'src/hold.js',
    'src/track.js',
    'src/flick.js',
    'src/tap.js'
  ];

  window[scopeName] = {
    entryPointName: thisFile,
    modules: modules
  };

  var script = document.querySelector('script[src $= "' + thisFile + '"]');
  var src = script.attributes.src.value;
  var basePath = src.slice(0, src.indexOf(thisFile));

  if (!window.PointerEvent) {
    document.write('<script src="' + basePath + '../PointerEvents/pointerevents.js"></script>');
  }

  if (!window.Loader) {
    var path = basePath + 'tools/loader/loader.js';
    document.write('<script src="' + path + '"></script>');
  }
  document.write('<script>Loader.load("' + scopeName + '")</script>');
})();
