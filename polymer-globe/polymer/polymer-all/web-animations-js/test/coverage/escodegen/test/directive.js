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

data = {
    'DirectiveStatement': {

        '\'use strict\';': {
            type: 'Program',
            body: [{
                type: 'DirectiveStatement',
                directive: 'use strict',
            }]
        },

        '(\'use strict\');': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'Literal',
                    value: 'use strict',
                }
            }]
        },

        '{\n    \'use strict\';\n}': {
            type: 'Program',
            body: [{
                type: 'BlockStatement',
                body: [{
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'Literal',
                        value: 'use strict',
                    }
                }]
            }]
        },

        '(function () {\n    (\'use strict\');\n});': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionExpression',
                    id: null,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: [{
                            type: 'ExpressionStatement',
                            expression: {
                                type: 'Literal',
                                value: 'use strict',
                            }
                        }]
                    }
                }
            }]
        },

        '(function () {\n    \'use strict\';\n});': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionExpression',
                    id: null,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: [{
                            type: 'DirectiveStatement',
                            directive: 'use strict',
                        }]
                    }
                }
            }]
        },

        '(function () {\n    "use strict";\n});': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionExpression',
                    id: null,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: [{
                            type: 'DirectiveStatement',
                            directive: 'use strict',
                            raw: '"use strict"'
                        }]
                    }
                }
            }]
        },

        '(function () {\n    \'use\\u0020strict\';\n});': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionExpression',
                    id: null,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: [{
                            type: 'DirectiveStatement',
                            directive: 'use\\u0020strict',
                        }]
                    }
                }
            }]
        },

        '(function () {\n    "use\\u0020strict\'";\n});': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionExpression',
                    id: null,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: [{
                            type: 'DirectiveStatement',
                            directive: 'use\\u0020strict\'',
                        }]
                    }
                }
            }]
        },

        '(function () {\n    {\n        \'use strict\';\n    }\n});': {
            type: 'Program',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionExpression',
                    id: null,
                    params: [],
                    body: {
                        type: 'BlockStatement',
                        body: [{
                            type: 'BlockStatement',
                            body: [{
                                type: 'ExpressionStatement',
                                expression: {
                                    type: 'Literal',
                                    value: 'use strict',
                                }
                            }]
                        }]
                    }
                }
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

function runTest(expected, result) {
    var actual, options;

    options = {
        indent: '    ',
        directive: true,
        parse: esprima.parse
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
                runTest(source, expected);
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
