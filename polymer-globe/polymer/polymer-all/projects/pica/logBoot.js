/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/* 
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function() {
  function startLogging() {
    console.time('boot');
    console.time('scripts');
  }
  
  function bootDone() {
    console.timeEnd('paint');
    console.timeEnd('boot');
    console.log('performance boot', Date.now() - performance.timing.navigationStart);
  }
  
  function scriptsDone() {
    console.timeEnd('scripts');
    console.time('load event');
  }
  
  function domDone() {
    console.timeEnd('load event');
    console.time('process imports');
  }
  
  function importsDone() {
    console.timeEnd('process imports');
    console.time('process elements');
    //console.profile('process elements');
  }
  
  function elementsDone() {
    console.timeEnd('process elements');
    console.time('paint');
    //console.profileEnd('process elements');
  }
  
  var logBoot = window.location.search.indexOf('logBoot') >= 0;
  if (logBoot) {
    startLogging();
    document.addEventListener('DOMContentLoaded', domDone);
    document.addEventListener('HTMLImportsLoaded', importsDone);
    document.addEventListener('WebComponentsReady', function() {
      elementsDone();
      requestAnimationFrame(bootDone);
    });
  }
    
  // exports
  window.logBoot = {
    scriptsDone: scriptsDone
  }
})();
