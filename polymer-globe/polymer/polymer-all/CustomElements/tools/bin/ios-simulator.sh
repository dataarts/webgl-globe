#!/bin/bash

# You must have ios-sim installed for this to work!
#   (https://github.com/phonegap/ios-sim)

tmpdir=/tmp/ios-simulator-$$

runSafari() {
  scriptdir=`dirname $0`
  mkdir $tmpdir
  unzip -d $tmpdir $scriptdir/IOSSimulatorSafariLauncher.app.zip
  ios-sim launch $tmpdir/IOSSimulatorSafariLauncher.app --family ipad --args "$1"
}

killSafari() {
  killall "iPhone Simulator"
  killall ios-sim
  rm -rf $tmpdir
}

trap "killSafari; exit 0" EXIT

runSafari "$1"
