module.exports = function(karma) {
  karma.configure({
    // Karma configuration

    // base path, that will be used to resolve files and exclude
    basePath: '',

    // list of files / patterns to load in the browser
    files: [
      'node_modules/chai/chai.js',
      'node_modules/chai-spies/chai-spies.js',
      'src/boot.js',
      'src/PointerEvent.js',
      'src/pointermap.js',
      'src/sidetable.js',
      'src/dispatcher.js',
      'src/installer.js',
      'src/mouse.js',
      'src/touch.js',
      'src/ms.js',
      'src/platform-events.js',
      'src/capture.js',
      'tests/setup.js',
      'tests/karma-setup.js',
      'tests/!(setup|karma-setup).js'
    ],

    // list of files to exclude
    exclude: [],

    frameworks: ['mocha'],

    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit'
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
    browsers: ['ChromeCanary'],

    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 50000,

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: true,

    reportSlowThan: 500,

    preprocessors: {},

    plugins: [
      'karma-mocha',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-script-launcher',
      'karma-crbot-reporter'
    ]
  });
};
