/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
module.exports = function(grunt) {
  ShadowDOMNative = [
    '../CustomElements/src/sidetable.js',
    'src/patches-shadowdom-native.js'
  ];

  ShadowDOMPolyfill = [
    'sidetable.js',
    'wrappers.js',
    'wrappers/events.js',
    'wrappers/NodeList.js',
    'wrappers/Node.js',
    'querySelector.js',
    'wrappers/node-interfaces.js',
    'wrappers/CharacterData.js',
    'wrappers/Element.js',
    'wrappers/HTMLElement.js',
    'wrappers/HTMLContentElement.js',
    'wrappers/HTMLShadowElement.js',
    'wrappers/HTMLTemplateElement.js',
    'wrappers/HTMLUnknownElement.js',
    'wrappers/generic.js',
    'wrappers/ShadowRoot.js',
    'ShadowRenderer.js',
    'wrappers/Document.js',
    'wrappers/Window.js',
    'wrappers/MutationObserver.js',
    'wrappers/override-constructors.js'
  ];
  ShadowDOMPolyfill = ShadowDOMPolyfill.map(function(p) {
    return '../ShadowDOM/src/' + p;
  });
  ShadowDOMPolyfill.push(
    'src/patches-shadowdom-polyfill.js',
    'src/ShadowCSS.js'
  );

  Lib = [
    'src/lang.js',
    'src/dom.js',
    'src/template.js',
    'src/inspector.js'
  ];

  MDV = [
    'third_party/ChangeSummary/change_summary.js',
    'src/template_element.js',
    'third_party/esprima/esprima.js',
    'util/expression_syntax.js'
  ];
  MDV = MDV.map(function(p) {
    return '../mdv/' + p;
  });

  MDV.push(
    'src/patches-mdv.js'
  );

  PointerEvents = [
    'boot.js',
    'touch-action.js',
    'PointerEvent.js',
    'pointermap.js',
    'sidetable.js',
    'dispatcher.js',
    'installer.js',
    'mouse.js',
    'touch.js',
    'ms.js',
    'platform-events.js',
    'capture.js',
  ];
  PointerEvents = PointerEvents.map(function(p) {
    return '../PointerEvents/src/' + p;
  });

  PointerGestures = [
    'PointerGestureEvent.js',
    'initialize.js',
    'sidetable.js',
    'pointermap.js',
    'dispatcher.js',
    'hold.js',
    'track.js',
    'flick.js',
    'tap.js'
  ];
  PointerGestures = PointerGestures.map(function(p) {
    return '../PointerGestures/src/' + p;
  });

  HTMLImports = [
    '../HTMLImports/src/HTMLImports.js',
    '../HTMLImports/src/Parser.js',
    '../HTMLImports/src/boot.js'
  ];

  CustomElements = [
    '../CustomElements/MutationObservers/MutationObserver.js',
    '../CustomElements/src/MutationObserver.js',
    '../CustomElements/src/CustomElements.js',
    '../CustomElements/src/Observer.js',
    '../CustomElements/src/HTMLElementElement.js',
    '../CustomElements/src/Parser.js',
    '../CustomElements/src/boot.js',
    'src/patches-custom-elements.js'
  ];

  Main = [].concat(
    Lib,
    MDV,
    HTMLImports,
    CustomElements,
    PointerEvents,
    PointerGestures
  );

  ConditionalShadowdom = [].concat(
    'build/if-poly.js',
    ShadowDOMPolyfill,
    'build/else.js',
    ShadowDOMNative,
    'build/end-if.js'
  );

  ConditionalPlatform = [].concat(
    'build/shadowdom.conditional.js',
    Main
  );
  
  NativeShadowPlatform = [].concat(
    ShadowDOMNative,
    Main
  );

  SandboxedChromeAppsPlatform = [].concat(
    'build/shadowdom.conditional.js',
    Lib,
    MDV,
    'src/patches-html-imports-csp.js',
    HTMLImports,
    CustomElements,
    PointerEvents,
    PointerGestures
  );
  
  // karma setup
  var browsers;
  (function() {
    try {
      var config = grunt.file.readJSON('local.json');
      if (config.browsers) {
        browsers = config.browsers;
      }
    } catch (e) {
      var os = require('os');
      browsers = ['Chrome', 'Firefox'];
      if (os.type() === 'Darwin') {
        browsers.push('ChromeCanary');
      }
      if (os.type() === 'Windows_NT') {
        browsers.push('IE');
      }
    }
  })();
  grunt.initConfig({
    karma: {
      options: {
        configFile: 'conf/karma.conf.js',
        keepalive: true,
        browsers: browsers
      },
      buildbot: {
        browsers: browsers,
        reporters: ['crbot'],
        logLevel: 'OFF'
      },
      platform: {
        browsers: browsers
      }
    },
    concat: {
      ShadowDom: {
        src: ConditionalShadowdom,
        dest: 'build/shadowdom.conditional.js',
        nonull: true
      }
    },
    uglify: {
      options: {
        banner: grunt.file.read('LICENSE'),
        nonull: true
      },
      Platform: {
        options: {
          sourceMap: 'platform.min.js.map',
          //mangle: false,
          //beautify: true,
          //report: 'gzip',
          compress: {
            // TODO(sjmiles): should be false by default (?)
            // https://github.com/mishoo/UglifyJS2/issues/165
            unsafe: false
          }
        },
        files: {
          'platform.min.js': ConditionalPlatform
        }
      },
      PlatformNative: {
        options: {
          sourceMap: 'platform.native.min.js.map',
          //mangle: false,
          //beautify: true,
          //report: 'gzip',
          compress: {
            // TODO(sjmiles): should be false by default (?)
            // https://github.com/mishoo/UglifyJS2/issues/165
            unsafe: false
          }
        },
        files: {
          'platform.native.min.js': NativeShadowPlatform
        }
      },
      PlatformSandboxedChromeApps: {
        options: {
          sourceMap: 'platform.sandbox.min.js.map',
          compress: {
            // TODO(sjmiles): should be false by default (?)
            // https://github.com/mishoo/UglifyJS2/issues/165
            unsafe: false
          }
        },
        files: {
          'platform.sandbox.min.js': SandboxedChromeAppsPlatform
        }
      }
    },

    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          exclude: 'third_party',
          paths: '.',
          outdir: 'docs',
          linkNatives: 'true',
          tabtospace: 2,
          themedir: '../docs/doc_themes/simple'
        }
      }
    },
    pkg: grunt.file.readJSON('package.json')
  });

  // plugins
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-karma');

  // tasks
  grunt.registerTask('default', ['concat', 'uglify']);
  grunt.registerTask('minify', ['concat', 'uglify']);
  grunt.registerTask('docs', ['yuidoc']);
  grunt.registerTask('test', ['karma:platform']);
  grunt.registerTask('test-buildbot', ['karma:buildbot']);
};

