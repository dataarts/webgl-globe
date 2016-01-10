#!/usr/bin/python
#
# -*- coding: utf-8 -*-
# vim: set ts=4 sw=4 et sts=4 ai:

import atexit
import cStringIO as StringIO
import json as simplejson
import os
import platform
import pprint
import re
import socket
import sys
import time
import urllib2
import zipfile

import argparse
parser = argparse.ArgumentParser()

parser.add_argument(
    "-b", "--browser", type=str, required=True,
    choices=['Firefox', 'Chrome', 'Ie', 'PhantomJS', 'Remote'],
    help="Which WebDriver to use.")

parser.add_argument(
    "-x", "--virtual", action='store_true', default=False,
    help="Use a virtual screen system such as Xvfb, Xephyr or Xvnc.")

parser.add_argument(
    "-d", "--dontexit", action='store_true', default=False,
    help="At end of testing, don't exit.")

parser.add_argument(
    "-a", "--auto-install", action='store_true', default=True,
    help="Auto install any dependencies.")

parser.add_argument(
    "-v", "--verbose", action='store_true', default=False,
    help="Output more information.")

parser.add_argument(
    "-u", "--upload", action='store_true', default=False,
    help="Upload images to picture sharing site (http://postimage.org/),"
         " only really useful for testbots.")

# Only used by the Remote browser option.
parser.add_argument(
    "--remote-executor", type=str,
    help="Location of the Remote executor.")

parser.add_argument(
    "--remote-caps", action='append',
    help="Location of capabilities to request on Remote executor.",
    default=[])

parser.add_argument(
    "-s", "--sauce", action='store_true', default=False,
    help="Use the SauceLab's Selenium farm rather then locally starting"
         " selenium. SAUCE_USERNAME and SAUCE_ACCESS_KEY must be set in"
         " environment.")

# Subunit / testrepository support
parser.add_argument(
    "--subunit", action='store_true', default=False,
    help="Output raw subunit binary data.")

parser.add_argument(
    "--list", action='store_true', default=False,
    help="List tests which are available.")

parser.add_argument(
    "--load-list", type=argparse.FileType('r'),
    help="List of tests to run.")

args = parser.parse_args()

if args.verbose and args.subunit:
    raise SystemExit("--verbose and --subunit are not compatible.")

# Make sure the repository is setup and the dependencies exist
# -----------------------------------------------------------------------------

import subprocess

# Set up the git repository
if args.auto_install:
    subprocess.check_call(["git", "submodule", "init"])
    subprocess.check_call(["git", "submodule", "update"])


# Install the python modules
def autoinstall(name, package=None):
    if not package:
        package = name

    if args.auto_install:
        try:
            import pip
        except ImportError:
            raise SystemExit("""\
Can not autoinstall as PIP is not avaliable.

To install 'pip' please ask your administrator to install the package
'python-pip' or run:
# sudo apt-get install python-pip
""")

        from pip.req import InstallRequirement
        install = InstallRequirement(package, None)
        install.check_if_exists()

        if install.satisfied_by is None:
            print "Unable to find %s, autoinstalling" % (name,)

            if install.conflicts_with:
                raise SystemExit("""
Can't install %s because it conflicts with already installed %s.

Please try installing %s manually with:
# sudo pip install --upgrade %s
""" % (name, install.conflicts_with, name, package.replace(">", "\>")))

            ret = subprocess.call(["pip", "install", "--user", package])
            if ret == 0:  # UNKNOWN_ERROR
                # Restart python is a nasty way, only method to get imports to
                # refresh.
                python = sys.executable
                os.execl(python, python, *sys.argv)
            else:
                raise SystemExit("""
Unknown error occurred.

Please install the Python %s module.
# sudo pip install %s
""" % (name, package.replace(">", "\n")))

for line in file(".requirements").readlines():
    if line.startswith('#') or not line.strip():
        continue

    if line.find('#') >= 0:
        package, name = line.split('#')

        autoinstall(name.strip(), package.strip())
    else:
        autoinstall(line.strip())

if not args.sauce:
    # Get any selenium drivers we might need
    if args.browser == "Chrome":
        # Get ChromeDriver if it's not in the path...
        # https://code.google.com/p/chromedriver/downloads/list
        chromedriver_bin = None
        if platform.system() == "Linux":
            chromedriver_bin = "chromedriver"
            if platform.processor() == "x86_64":
                # 64 bit binary needed
                chromedriver_url = "https://chromedriver.googlecode.com/files/chromedriver2_linux64_0.6.zip"  # noqa
            else:
                # 32 bit binary needed
                chromedriver_url = "https://chromedriver.googlecode.com/files/chromedriver_linux32_26.0.1383.0.zip"  # noqa

        elif platform.system() == "mac":
            chromedriver_url = "https://chromedriver.googlecode.com/files/chromedriver2_mac32_0.7.zip"  # noqa
            chromedriver_bin = "chromedriver"
        elif platform.system() == "win32":
            chromedriver_bin = "https://chromedriver.googlecode.com/files/chromedriver2_win32_0.7.zip"  # noqa
            chromedriver_url = "chromedriver.exe"

        try:
            if subprocess.call(chromedriver_bin) != 0:
                raise OSError("Return code?")
        except OSError:
            chromedriver_local = os.path.join("tools", chromedriver_bin)

            if not os.path.exists(chromedriver_local):
                datafile = StringIO.StringIO(
                    urllib2.urlopen(chromedriver_url).read())
                contents = zipfile.ZipFile(datafile, 'r')
                contents.extract(chromedriver_bin, "tools")

            chromedriver = os.path.realpath(chromedriver_local)
            os.chmod(chromedriver, 0755)
        else:
            chromedriver = "chromedriver"

    elif args.browser == "Firefox":
        pass

    elif args.browser == "PhantomJS":
        phantomjs_bin = None
        if platform.system() == "Linux":
            phantomjs_bin = "phantomjs"
            if platform.processor() == "x86_64":
                # 64 bit binary needed
                phantomjs_url = "https://phantomjs.googlecode.com/files/phantomjs-1.9.0-linux-x86_64.tar.bz2"  # noqa
            else:
                # 32 bit binary needed
                phantomjs_url = "https://phantomjs.googlecode.com/files/phantomjs-1.9.0-linux-i686.tar.bz2"  # noqa

            phantomjs_local = os.path.join("tools", phantomjs_bin)
            if not os.path.exists(phantomjs_local):
                datafile = StringIO.StringIO(
                    urllib2.urlopen(phantomjs_url).read())
                contents = tarfile.TarFile.open(fileobj=datafile, mode='r:bz2')
                file("tools/"+phantomjs_bin, "w").write(
                    contents.extractfile(
                        "phantomjs-1.9.0-linux-x86_64/bin/"+phantomjs_bin
                    ).read())

            phantomjs = os.path.realpath(phantomjs_local)
            os.chmod(phantomjs, 0755)
        else:
            if platform.system() == "mac":
                phantomjs_url = "https://phantomjs.googlecode.com/files/phantomjs-1.9.0-macosx.zip"  # noqa
                phantomjs_bin = "phantomjs"

            elif platform.system() == "win32":
                chromedriver_bin = "https://phantomjs.googlecode.com/files/phantomjs-1.9.0-windows.zip"  # noqa
                phantomjs_url = "phantomjs.exe"

            phantomjs_local = os.path.join("tools", phantomjs_bin)
            if not os.path.exists(phantomjs_local):
                datafile = StringIO.StringIO(
                    urllib2.urlopen(phantomjs_url).read())
                contents = zipfile.ZipFile(datafile, 'r')
                contents.extract(phantomjs_bin, "tools")

            phantomjs = os.path.realpath(phantomjs_local)
            os.chmod(phantomjs, 0755)
else:
    assert os.environ['SAUCE_USERNAME']
    assert os.environ['SAUCE_ACCESS_KEY']
    username = os.environ['SAUCE_USERNAME']
    key = os.environ['SAUCE_ACCESS_KEY']

    # Download the Sauce Connect script
    sauce_connect_url = "http://saucelabs.com/downloads/Sauce-Connect-latest.zip"  # noqa
    sauce_connect_bin = "Sauce-Connect.jar"
    sauce_connect_local = os.path.join("tools", sauce_connect_bin)
    if not os.path.exists(sauce_connect_local):
        datafile = StringIO.StringIO(urllib2.urlopen(sauce_connect_url).read())
        contents = zipfile.ZipFile(datafile, 'r')
        contents.extract(sauce_connect_bin, "tools")

    if 'TRAVIS_JOB_NUMBER' in os.environ:
        tunnel_id = os.environ['TRAVIS_JOB_NUMBER']
    else:
        tunnel_id = "%s:%s" % (socket.gethostname(), os.getpid())
    args.remote_caps.append('tunnel-identifier=%s' % tunnel_id)

    # Kill the tunnel when we die
    def kill_tunnel(sauce_tunnel):
        if sauce_tunnel.returncode is None:
            sauce_tunnel.terminate()

            timeout = time.time()
            while sauce_tunnel.poll() is None:
                if time.time() - timeout < 30:
                    time.sleep(1)
                else:
                    sauce_tunnel.kill()

    readyfile = "."+tunnel_id
    sauce_tunnel = None
    try:
        sauce_log = file("sauce_tunnel.log", "w")
        sauce_tunnel = subprocess.Popen(
            ["java", "-jar", sauce_connect_local,
             "--readyfile", readyfile,
             "--tunnel-identifier", tunnel_id,
             username, key],
            stdout=sauce_log, stderr=sauce_log)

        atexit.register(kill_tunnel, sauce_tunnel)

        # Wait for the tunnel to come up
        while not os.path.exists(readyfile):
            time.sleep(0.5)

    except:
        if sauce_tunnel:
            kill_tunnel(sauce_tunnel)
        raise

    args.remote_executor = "http://%s:%s@localhost:4445/wd/hub" % (
        username, key)

    # Send travis information upstream
    if 'TRAVIS_BUILD_NUMBER' in os.environ:
        args.remote_caps.append('build=%s' % os.environ['TRAVIS_BUILD_NUMBER'])

# -----------------------------------------------------------------------------

import subunit
import testtools
import unittest

if args.list:
    data = file("test/testcases.js").read()
    for test in re.compile("(?<=').+(?=')").findall(data):
        print test[:-5]
    sys.exit(-1)

if args.load_list:
    tests = list(set(x.split(':')[0].strip()+'.html'
                 for x in args.load_list.readlines()))
else:
    tests = []

# Collect summary of all the individual test runs
summary = testtools.StreamSummary()

# Output information to stdout
if not args.subunit:
    # Human readable test output
    pertest = testtools.StreamToExtendedDecorator(
        testtools.MultiTestResult(
            # Individual test progress
            unittest.TextTestResult(
                unittest.runner._WritelnDecorator(sys.stdout), False, 2),
            # End of run, summary of failures.
            testtools.TextTestResult(sys.stdout),
        )
    )
else:
    from subunit.v2 import StreamResultToBytes
    pertest = StreamResultToBytes(sys.stdout)

    if args.list:
        output = subunit.CopyStreamResult([summary, pertest])
        output.startTestRun()
        for test in re.compile("(?<=').+(?=')").findall(
                file("test/testcases.js").read()):
            output.status(test_status='exists', test_id=test[:-5])

        output.stopTestRun()
        sys.exit(-1)

output = subunit.CopyStreamResult([summary, pertest])
output.startTestRun()

# Start up a local HTTP server which serves the files to the browser and
# collects the test results.
# -----------------------------------------------------------------------------
import SimpleHTTPServer
import SocketServer
import threading
import cgi
import re

import itertools
import mimetools
import mimetypes


class MultiPartForm(object):
    """Accumulate the data to be used when posting a form."""

    def __init__(self):
        self.form_fields = []
        self.files = []
        self.boundary = mimetools.choose_boundary()
        return

    def get_content_type(self):
        return 'multipart/form-data; boundary=%s' % self.boundary

    def add_field(self, name, value):
        """Add a simple field to the form data."""
        self.form_fields.append((name, value))
        return

    def add_file(self, fieldname, filename, fileHandle, mimetype=None):
        """Add a file to be uploaded."""
        body = fileHandle.read()
        if mimetype is None:
            mimetype = (
                mimetypes.guess_type(filename)[0] or
                'application/octet-stream')
        self.files.append((fieldname, filename, mimetype, body))
        return

    def __str__(self):
        """Return a string representing the form data, with attached files."""
        # Build a list of lists, each containing "lines" of the
        # request.  Each part is separated by a boundary string.
        # Once the list is built, return a string where each
        # line is separated by '\r\n'.
        parts = []
        part_boundary = '--' + self.boundary

        # Add the form fields
        parts.extend([
            part_boundary,
            'Content-Disposition: form-data; name="%s"' % name,
            '',
            value,
        ] for name, value in self.form_fields)

        # Add the files to upload
        parts.extend([
            part_boundary,
            'Content-Disposition: file; name="%s"; filename="%s"' % (
                field_name, filename),
            'Content-Type: %s' % content_type,
            '',
            body,
        ] for field_name, filename, content_type, body in self.files)

        # Flatten the list and add closing boundary marker,
        # then return CR+LF separated data
        flattened = list(str(b) for b in itertools.chain(*parts))
        flattened.append('--' + self.boundary + '--')
        flattened.append('')
        return '\r\n'.join(flattened)


class ServerHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    STATUS = {0: 'success', 1: 'fail', 2: 'fail', 3: 'skip'}

    # Make the HTTP requests be quiet
    def log_message(self, format, *a):
        if args.verbose:
            SimpleHTTPServer.SimpleHTTPRequestHandler.log_message(
                self, format, *a)

    def do_POST(self):
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': self.headers['Content-Type'],
            })

        data = simplejson.loads(form.getvalue('data'))

        overall_status = 0
        for result in data['results']:
            info = dict(result)
            info.pop('_structured_clone', None)

            overall_status += result['status']
            output.status(
                test_id="%s:%s" % (data['testName'][:-5], result['name']),
                test_status=self.STATUS[result['status']],
                test_tags=[args.browser],
                file_name='message',
                file_bytes=repr(result['message']),
                mime_type='text/plain; charset=UTF-8',
                eof=True)

        # Take a screenshot of result if a failure occurred.
        if overall_status > 0 and args.virtual:
            screenshot = data['testName'] + '.png'
            disp.grab().save(screenshot)

            if args.upload:
                form = MultiPartForm()
                form.add_field('adult', 'no')
                form.add_field('optsize', '0')
                form.add_file(
                    'upload[]', screenshot, fileHandle=open(screenshot, 'rb'))

                request = urllib2.Request("http://postimage.org/")
                body = str(form)
                request.add_header('Content-type', form.get_content_type())
                request.add_header('Content-length', len(body))
                request.add_data(body)

                result = urllib2.urlopen(request).read()
                print "Screenshot at:", re.findall("""<td><textarea wrap='off' onmouseover='this.focus\(\)' onfocus='this.select\(\)' id="code_1" scrolling="no">([^<]*)</textarea></td>""", result)  # noqa

        response = "OK"
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.send_header("Content-length", len(response))
        self.end_headers()
        self.wfile.write(response)
        self.wfile.close()

httpd = SocketServer.TCPServer(
    ("127.0.0.1", 0),  # Bind to any port on localhost
    ServerHandler)
httpd_thread = threading.Thread(target=httpd.serve_forever)
httpd_thread.daemon = True
httpd_thread.start()

port = httpd.socket.getsockname()[-1]

# Start up a virtual display, useful for testing on headless servers.
# -----------------------------------------------------------------------------

# PhantomJS doesn't need a display
disp = None
if args.virtual and args.browser != "PhantomJS":
    from pyvirtualdisplay.smartdisplay import SmartDisplay

    try:
        disp = SmartDisplay(visible=0, bgcolor='black').start()
        atexit.register(disp.stop)
    except:
        if disp:
            disp.stop()
        raise


# Start up the web browser and run the tests.
# ----------------------------------------------------------------------------

from selenium import webdriver

driver_arguments = {}
if args.browser == "Chrome":
    import tempfile
    import shutil

    # We reference shutil to make sure it isn't garbaged collected before we
    # use it.
    def directory_cleanup(directory, shutil=shutil):
        try:
            shutil.rmtree(directory)
        except OSError, e:
            pass

    try:
        user_data_dir = tempfile.mkdtemp()
        atexit.register(directory_cleanup, user_data_dir)
    except:
        directory_cleanup(user_data_dir)
        raise

    driver_arguments['chrome_options'] = webdriver.ChromeOptions()
    # Make printable
    webdriver.ChromeOptions.__repr__ = lambda self: str(self.__dict__)
    driver_arguments['chrome_options'].add_argument(
        '--user-data-dir=%s' % user_data_dir)
    driver_arguments['chrome_options'].add_argument(
        '--enable-logging')

    driver_arguments['chrome_options'].binary_location = (
        '/usr/bin/google-chrome')
    driver_arguments['executable_path'] = chromedriver

    # Travis-CI uses OpenVZ containers which are incompatible with the sandbox
    # technology.
    # See https://code.google.com/p/chromium/issues/detail?id=31077 for more
    # information.
    if 'TRAVIS' in os.environ:
        driver_arguments['chrome_options'].add_argument('--no-sandbox')

elif args.browser == "Firefox":
    driver_arguments['firefox_profile'] = webdriver.FirefoxProfile()

elif args.browser == "PhantomJS":
    driver_arguments['executable_path'] = phantomjs
    driver_arguments['service_args'] = ['--remote-debugger-port=9000']

elif args.browser == "Remote":
    driver_arguments['command_executor'] = args.remote_executor
    caps = {}

    for arg in args.remote_caps:
        if not arg.strip():
            continue

        if arg.find('=') < 0:
            caps.update(getattr(
                webdriver.DesiredCapabilities, arg.strip().upper()))
        else:
            key, value = arg.split('=', 1)
            caps[key] = value
    driver_arguments['desired_capabilities'] = caps

try:
    browser = None
    try:
        if args.verbose:
            print driver_arguments
        browser = getattr(webdriver, args.browser)(**driver_arguments)
        atexit.register(browser.close)
    except:
        if browser:
            browser.close()
        raise

    url = 'http://localhost:%i/test/test-runner.html?%s' % (
        port, "|".join(tests))
    browser.get(url)

    def close_other_windows(browser, url):
        for win in browser.window_handles:
            browser.switch_to_window(win)
            if browser.current_url != url:
                browser.close()
        browser.switch_to_window(browser.window_handles[0])

    while True:
        # Sometimes other windows are accidently opened (such as an extension
        # popup), close them.
        if len(browser.window_handles) > 1:
            close_other_windows(browser, url)

        if not browser.execute_script('return window.finished'):
            time.sleep(1)
            continue
        else:
            break

finally:
    output.stopTestRun()

    if args.browser == "Chrome":
        shutil.copy(os.path.join(user_data_dir, "chrome_debug.log"), ".")

while args.dontexit and browser.window_handles:
    time.sleep(1)

if summary.testsRun == 0:
   print
   print "FAIL: No tests run!"

if summary.wasSuccessful() and summary.testsRun > 0:
    sys.exit(0)
else:
    sys.exit(1)
