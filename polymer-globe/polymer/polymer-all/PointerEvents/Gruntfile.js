module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-karma');

  var os = require('os').type();
  var browsers = ['Chrome', 'Firefox'];
  var sourceFiles = grunt.file.readJSON('build.json');

  if (os == 'Darwin') {
    browsers.push('ChromeCanary');
  }
  if (os == 'Windows_NT') {
    browsers.push('IE');
  }

  grunt.initConfig({
    concat: {
      pointerevents: {
        options: {
          stripBanners: true,
          banner: grunt.file.read('LICENSE')
        },
        src: sourceFiles,
        dest: 'pointerevents.dev.js'
      }
    },
    uglify: {
      pointerevents: {
        options: {
          sourceMap: 'pointerevents.min.js.map',
          banner: grunt.file.read('LICENSE')
        },
        dest: 'pointerevents.min.js',
        src: sourceFiles
      }
    },
    karma: {
      options: {
        browsers: browsers,
        configFile: 'karma.conf.js'
      },
      polymer: {
      },
      buildbot: {
        reporters: 'crbot',
        logLevel: 'OFF'
      },
      browserstack: {
        browsers: "BrowserStack:IE:Win"
      }
    }
  });

  grunt.registerTask('default', ['concat', 'uglify']);
  grunt.registerTask('test', 'karma:polymer');
  grunt.registerTask('test-buildbot', 'karma:buildbot');
};
