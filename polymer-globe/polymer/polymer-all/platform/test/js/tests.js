/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

htmlSuite('loader and build', function() {
  htmlTest('html/dev-loader.html');
  htmlTest('html/dev-loader-swizzled.html');
  // htmlTest('html/production-loader.html');
  htmlTest('html/loader-forcepoly.html');
});

htmlSuite('integration', function() {
  htmlTest('html/web-components.html');
  htmlTest('html/smoke.html');
  htmlTest('html/smoke.html?shadow=polyfill');
  htmlTest('html/strawkit.html');
  htmlTest('html/strawkit.html?shadow=polyfill');
  htmlTest('html/mdv-shadow.html');
	//htmlTest('html/html-import-sandbox.html');
});

htmlSuite('styling', function() {
  htmlTest('html/styling/host.html');
  htmlTest('html/styling/host.html?shadow');
  htmlTest('html/styling/pseudo-scoping.html');
  htmlTest('html/styling/pseudo-scoping.html?shadow');
  htmlTest('html/styling/pseudos.html');
  htmlTest('html/styling/pseudos.html?shadow');
  htmlTest('html/styling/polyfill-directive.html');
});
