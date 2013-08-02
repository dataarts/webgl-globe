# humane.js
This project was heavily inspired by [humanmsg](http://code.google.com/p/humanmsg/) project for jQuery.  I really
liked the project but I wanted to remove the jQuery dependency, add support for CSS transitions, and have more 
control over the timing.

## About
humane.js tries to be as unobtrusive as possible to the user experience while providing helpful information that is
clear and grabs the users attention.  It is framework independent.  Customizable.

## Setup
Setup is simple:

  - Download tar/zip
  - Select a [theme](humane-js/wiki/Themes) from `themes` dir.
  - Include the theme CSS in your page
  - Include `humane.min.js` in your page

## Demo/Usage

You can see a [demo and usage here](http://wavded.github.com/humane-js/)

## Custom Themes

Got a neat theme/animation, love to see it.  View `theme-src/bigbox.styl` for an template to get started (uses [Stylus](http://learnboost.github.com/stylus/) w/ Nib and Canvas).

To get setup with Stylus use [npm](http://npmjs.org):

```sh
(sudo) npm install -g stylus nib canvas
```

With Stylus installed you can watch for changes and compile into CSS by running:

```sh
make watch
```

## Desktop and Mobile Browser Support

humane.js has been tested for the following browsers.

  - Internet Explorer 7+
  - Firefox 3+
  - Chrome 9+
  - Safari 3+
  - Opera 10+
  - iOS 4+
  - Android 2+

## AMD and Node.js Support

humane.js works for AMD systems like [require.js](http://requirejs.org/) and within Node.js CommonJS module system like [browserify](https://github.com/substack/node-browserify).

## Contributers

Many thanks to the JS/Browser wizards that helped make this better, community rocks!

- @bga_ (Alexander)
- @joseanpg (Jose)
- @OiNutter (Will McKenzie)
- @ianmassey (Ian Massey)

## License

(The MIT License)

Copyright (c) 2011 Marc Harter &lt;wavded@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
