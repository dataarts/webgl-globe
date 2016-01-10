/*
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint browser:true node:true */
/*global escodegen:true, esprima:true*/

(function () {
    'use strict';
    var total = 0,
        failures = [],
        tick,
        fs = require('fs'),
        expected,
        header,
        fixtures,
        esprima,
        escodegen;

    if (typeof window === 'undefined') {
        esprima = require('./3rdparty/esprima-harmony');
        escodegen = require('../escodegen');
    }

    function slug(name) {
        return name.toLowerCase().replace(/\s/g, '-');
    }

    function adjustRegexLiteral(key, value) {
        if (key === 'value' && value instanceof RegExp) {
            value = value.toString();
        }
        return value;
    }

    function NotMatchingError(expected, actual) {
        Error.call(this, 'Expected ');
        this.expected = expected;
        this.actual = actual;
    }
    NotMatchingError.prototype = new Error();

    function test(code, expected) {
        var tree, actual, options, StringObject;

        // alias, so that JSLint does not complain.
        StringObject = String;

        options = {
            range: true,
            loc: false,
            tokens: true,
            raw: false
        };

        try {
            tree = esprima.parse(code, options);

            // for UNIX text comment
            actual = escodegen.generate(tree).replace(/[\n\r]$/, '') + '\n';
        } catch (e) {
            console.error(e.stack);
            throw new NotMatchingError(expected, e.toString());
        }
        if (expected !== actual) {
            throw new NotMatchingError(expected, actual);
        }
    }

    total = 0;
    tick = new Date();
    fs.readdirSync(__dirname + '/compare-harmony').sort().forEach(function(file) {
        var code, expected, p;
        if (/\.js$/.test(file)) {
            if (!/expected\.js$/.test(file)) {
                p = file.replace(/\.js$/, '.expected.js');
                total += 1;
                code = fs.readFileSync(__dirname + '/compare-harmony/' + file, 'utf-8');
                expected = fs.readFileSync(__dirname + '/compare-harmony/' + p, 'utf-8');
                try {
                    test(code, expected);
                } catch (e) {
                    e.source = code;
                    failures.push(e);
                }
            }
        }
    });
    tick = (new Date()) - tick;

    header = total + ' tests. ' + failures.length + ' failures. ' +
        tick + ' ms';
    if (failures.length) {
        console.error(header);
        failures.forEach(function (failure) {
            console.error(failure.source + ': Expected\n    ' +
                failure.expected.split('\n').join('\n    ') +
                '\nto match\n    ' + failure.actual);
        });
    } else {
        console.log(header);
    }
}());
/* vim: set sw=4 ts=4 et tw=80 : */
