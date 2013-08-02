#!/bin/bash

# need to add x11 binaries to the PATH if on mac
if ! which xauth > /dev/null; then
  if [ "`uname`" == "Darwin" ]; then
    export PATH=$PATH:/usr/X11R6/bin
  fi
fi
xvfb-run grunt test-buildbot
rc=$?
echo "@@@STEP_CURSOR test@@@"
if [ "x$rc" != "x0" ]; then
  echo "@@@STEP_FAILURE@@@"
fi
