#!/usr/bin/env node
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

/*jslint sloppy:true node:true */

var fs = require('fs'),
    path = require('path'),
    root = path.join(path.dirname(fs.realpathSync(__filename)), '..'),
    escodegen = require(root),
    esprima = require('esprima'),
    bower = require('bower'),
    semver = require('semver'),
    child_process = require('child_process'),
    Q = require('q');

function exec(cmd) {
    var ret = Q.defer();
    console.log(cmd);
    child_process.exec(cmd, function (error, stdout, stderr) {
        ret.resolve(error, stdout, stderr);
    });
    return ret.promise;
}

(function () {
    var config, matched, version, devVersion;

    config = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    devVersion = config.version;
    matched = devVersion.match(/^(\d+\.\d+\.\d+(-\d+)?)-dev$/);
    if (!matched) {
        console.error('version style "' + devVersion + '" is not matched to X.X.X[-X]-dev.');
        process.exit(1);
    }

    version = matched[1];
    config.version = version;

    function ping(memo, name) {
        var pattern, ret;

        ret = Q.defer();
        pattern = config.dependencies[name];

        bower.commands.info(name)
        .on('end', function (result) {
            var i, iz, version;
            for (i = 0, iz = result.versions.length; i < iz; ++i) {
                version = result.versions[i];
                if (semver.satisfies(version, pattern)) {
                    memo[name] = pattern;
                    ret.resolve();
                    return;
                }
            }

            // not satisfies
            console.error(name + ' with ' + pattern + ' is not satisfied');
            ret.resolve();
        })
        .on('error', function (error) {
            console.error(error.message + '. skip this dependency');
        });

        return ret.promise;
    }

    exec('git branch -D ' + version)
    .then(function () {
        return exec('git checkout -b ' + version);
    })
    .then(function browserify() {
        return exec('npm run-script build');
    })
    .then(function generateConfigs() {
        var dependencies = {},
            optionalDependencies = {};
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(config, null, 4), 'utf-8');

        // generate component.json
        return Q.all(
            Object.keys(config.dependencies).map(ping.bind(null, dependencies)),
            Object.keys(config.optionalDependencies).map(ping.bind(null, optionalDependencies))
                ).then(function () {
            config.dependencies = dependencies;
            config.optionalDependencies = optionalDependencies;
            fs.writeFileSync(path.join(root, 'component.json'), JSON.stringify(config, null, 4), 'utf-8');
        });
    })
    .then(function gitAdd() {
        return exec('git add "' + root + '"');
    })
    .then(function gitCommit() {
        return exec('git commit -m "Bump version ' + version + '"');
    })
    .then(function gitDeleteTag() {
        return exec('git tag -d ' + version);
    })
    .then(function gitAddTag() {
        return exec('git tag -a ' + version + ' -m "version ' + version + '"');
    })
    .then(function () {
        console.log('Finally you should execute npm publish and git push --tags');
    });
}());

/* vim: set sw=4 ts=4 et tw=80 : */
