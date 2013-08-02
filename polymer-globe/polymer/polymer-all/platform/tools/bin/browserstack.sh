#!/bin/bash

browserstack=./node_modules/browserstack-cli/bin/cli.js

runBS() {
  $browserstack tunnel localhost:9876 &
  tunnelPid=$!
  $browserstack launch --attach --os $2 $1 $3
}

killBS() {
  kill -s STOP $tunnelPid
}

trap "killBS; exit 0" EXIT

browser=$1
os=$2
url=$3
runBS $browser $os $url
