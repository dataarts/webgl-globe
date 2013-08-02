#!/bin/bash

runChrome() {
  adb shell am start -a android.intent.action.VIEW -n com.android.chrome/.Main -d "$1"
  tail -f /dev/null
}

killChrome() {
  adb shell am force-stop com.android.chrome
}

trap "killChrome; exit 0" EXIT

url=$1
runChrome "${url/localhost/10.0.2.2}"
