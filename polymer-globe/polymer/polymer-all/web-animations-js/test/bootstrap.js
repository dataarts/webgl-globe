/**
 * Copyright 2013 Google Inc. All Rights Reserved.
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
'use strict';

(function() {

var thisScript = document.querySelector("script[src$='bootstrap.js']");
var coverageMode = Boolean(parent.window.__coverage__) || /coverage/.test(window.location.hash);

// Inherit these properties from the parent test-runner if any.
window.__resources__ = parent.window.__resources__ || {original: {}};
window.__coverage__ = parent.window.__coverage__;

function getSync(src) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', src, false);
  xhr.send();
  if (xhr.responseCode > 400) {
    console.error('Error loading ' + src);
    return '';
  }
  return xhr.responseText;
}

function loadScript(src, options) {
  options = options || {coverage: true};
  if (window.__resources__[src]) {
    (function() {
      eval(window.__resources__[src]);
    }).call(window);
  } else if (coverageMode && options.coverage) {
    instrument(src);
    loadScript(src);
  } else {
    document.write('<script type="text/javascript" src="'+ src + '"></script>');
  }
}

function loadCSS(src) {
  document.write('<link rel="stylesheet" type="text/css" href="' + src + '">');
}

function hasFlag(flag) {
  return thisScript && thisScript.getAttribute(flag) !== null;
}

function isUnitTest() {
  return /unit-test[^\\\/]*\.html$/.exec(location.pathname);
}

var instrumentationDepsLoaded = false;
/**
 * Instrument the source at {@code location} and store it in
 * {@code window.__resources__[name]}.
 */
function instrument(src) {
  if (__resources__[src]) {
    return;
  }
  if (!instrumentationDepsLoaded) {
    instrumentationDepsLoaded = true;
    (function() {
      eval(getSync('../coverage/esprima/esprima.js'));
      eval(getSync('../coverage/escodegen/escodegen.browser.js'));
      eval(getSync('../coverage/istanbul/lib/instrumenter.js'));
    }).call(window);
  }
  var js = getSync(src);
  window.__resources__.original[src] = js;
  var inst = window.__resources__[src] = new Instrumenter().instrumentSync(js, src);
}

loadScript('../testharness/testharness.js');
loadCSS('../testharness/testharness.css');

loadScript('../testharness_extensions.js');

// Don't load the timing functions in unittests.
if (!isUnitTest()) {
  loadScript('../testharness_timing.js');
  loadCSS('../testharness_timing.css');
}

if (!isUnitTest() && !hasFlag('nochecks')) {
  loadScript(location.pathname.replace('.html', '-checks.js'), {coverage: false});
}

document.write('<div id="log"></div>');
loadScript('../testharness/testharnessreport.js');

if (!hasFlag('nopolyfill')) {
  loadScript('../../web-animations.js');
}
})();
