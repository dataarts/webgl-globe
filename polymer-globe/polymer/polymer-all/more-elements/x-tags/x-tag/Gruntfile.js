module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint:{
      all: ['Gruntfile.js']
    },
    'smush-components': {
      options: {
        fileMap: {
          js: 'demo/x-tag-components.js',
          css: 'demo/x-tag-components.css'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-smush-components');

  grunt.registerTask('build', ['jshint','smush-components']);

};
