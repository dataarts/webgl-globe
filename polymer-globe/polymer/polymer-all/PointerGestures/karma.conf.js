module.exports = function(karma) {
  karma.configure({
    // base path, that will be used to resolve files and exclude
    basePath: '../',


    // frameworks to use
    frameworks: ['mocha'],


    // list of files / patterns to load in the browser
    files: [
      'PointerGestures/node_modules/chai/chai.js',
      'PointerGestures/node_modules/chai-spies/chai-spies.js',
      'PointerEvents/src/boot.js',
      'PointerEvents/src/PointerEvent.js',
      'PointerEvents/src/pointermap.js',
      'PointerEvents/src/sidetable.js',
      'PointerEvents/src/dispatcher.js',
      'PointerEvents/src/installer.js',
      'PointerEvents/src/mouse.js',
      'PointerEvents/src/touch.js',
      'PointerEvents/src/ms.js',
      'PointerEvents/src/platform-events.js',
      'PointerEvents/src/capture.js',
      'PointerGestures/src/PointerGestureEvent.js',
      'PointerGestures/src/initialize.js',
      'PointerGestures/src/sidetable.js',
      'PointerGestures/src/pointermap.js',
      'PointerGestures/src/dispatcher.js',
      'PointerGestures/src/hold.js',
      'PointerGestures/src/track.js',
      'PointerGestures/src/flick.js',
      'PointerGestures/src/tap.js',
      'PointerGestures/tests/setup.js',
      'PointerGestures/tests/!(setup).js'
    ],


    // list of files to exclude
    exclude: [],


    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['progress'],


    // web server port
    port: 9876,


    // cli runner port
    runnerPort: 9100,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: karma.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['Chrome'],


    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,


    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: true,


    // plugins to load
    plugins: [
      'karma-mocha',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-script-launcher',
      'karma-crbot-reporter'
    ]
  });
};
