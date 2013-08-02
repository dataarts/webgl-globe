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

'use strict';
var data, esprima, escodegen;

esprima = require('./3rdparty/esprima');
escodegen = require('../escodegen');


function make_eval(code) {
    return {
        type: 'CallExpression',
        callee: {
            type: 'Identifier',
            name: 'eval'
        },
        'arguments': [{
            type: 'Literal',
            value: code
        }],
        verbatim: code
    };
}

data = {
    'DISABLED': {
        "eval('foo');": {
            type: 'ExpressionStatement',
            expression: make_eval('foo')
        }
    },

    'verbatim': {
        // Check it doesn't apply to statements
        "continue;": {
            type: 'ContinueStatement',
            verbatim: 'FOOBARBAZ'
        },
        "foo;": {
            type: 'ExpressionStatement',
            expression: make_eval('foo')
        },
        "true && (foo)": {
            type: 'BinaryExpression',
            operator: '&&',
            left: { type: 'Literal', value: true },
            right: make_eval('foo')
        },
        "var a = (window.location.href);": {
            type: 'VariableDeclaration',
            kind: 'var',
            declarations: [{
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: 'a' },
                init: make_eval('window.location.href')
            }]
        },
        // Multiline
        "if (true) {\n    foo('bar');\n    foo('baz');\n}": {
            type: 'IfStatement',
            test: { type: 'Literal', value: true },
            consequent: {
                type: 'BlockStatement',
                body: [{
                    type: 'ExpressionStatement',
                    expression: make_eval("foo('bar');\nfoo('baz')")
                }]
            }
        },
        // Embedded into sequences
        "foo(a, (10, 20), b)": {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'foo' },
            arguments: [{
                type: 'Identifier',
                name: 'a'
            },
            make_eval('10, 20'),
            {
                type: 'Identifier',
                name: 'b'
            }]
        }
    }
};

function NotMatchingError(expected, actual) {
    'use strict';
    Error.call(this, 'Expected ');
    this.expected = expected;
    this.actual = actual;
}
NotMatchingError.prototype = new Error();

function runTest(expected, result, verbatim) {
    var actual, options;

    options = {
        indent: '    ',
        directive: true,
        parse: esprima.parse,
        verbatim: verbatim
    };

    try {
        actual = escodegen.generate(result, options);
    } catch (e) {
        throw new NotMatchingError(expected, e.toString());
    }
    if (expected !== actual) {
        throw new NotMatchingError(expected, actual);
    }
}

(function driver() {
    var total = 0,
        failures = [],
        tick = new Date(),
        expected,
        header;

    Object.keys(data).forEach(function (category) {
        Object.keys(data[category]).forEach(function (source) {
            total += 1;
            expected = data[category][source];
            try {
                runTest(source, expected, category);
            } catch (e) {
                e.source = source;
                failures.push(e);
            }
        });
    });
    tick = (new Date()) - tick;

    header = total + ' tests. ' + failures.length + ' failures. ' + tick + ' ms';
    if (failures.length) {
        console.error(header);
        failures.forEach(function (failure) {
            console.error('Expected\n    ' +
                failure.source.split('\n').join('\n    ') +
                '\nto match\n    ' + failure.actual);
        });
    } else {
        console.log(header);
    }
    process.exit(failures.length === 0 ? 0 : 1);
}());
