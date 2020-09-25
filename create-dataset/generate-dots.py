# -*- coding: utf-8 -*-
"""
@author: heltonfabio
"""
import json
import time
import sys
import io


class Unbuffered(object):
    def __init__(self, stream):
        self.stream = stream

    def write(self, data):
        self.stream.write(data)
        self.stream.flush()

    def writelines(self, datas):
        self.stream.writelines(datas)
        self.stream.flush()

    def __getattr__(self, attr):
        return getattr(self.stream, attr)


sys.stdout = Unbuffered(sys.stdout)


class generator:
    start = time.time()
    _default_dot = True
    _score = []
    _default_dots = []
    _generated_dots = []

    def getScore(self):
        with open('scores.json', 'r') as f:
            self._score = json.load(f)

    def getDefaultCountriesDots(self):
        with open('countries-default.json', 'r') as f:
            self._default_dots = json.load(f)

    def generateDots(self):
        for category in self._score:
            dots = []
            for default_dot in self._default_dots:
                score = self.getCountryScore(
                    category['category'], default_dot[0])
                if self._default_dot:
                    for dot in default_dot[1]:
                        dots.extend(dot)
                        dots.append(score)
                else:
                    if score != 0.00001:
                        for dot in default_dot[1]:
                            dots.extend(dot)
                            dots.append(score)
            dots = [float(i) for i in dots]
            if len(dots) > 0:
                self._generated_dots.append([category['category'], dots])

    def getCountryScore(self, category, code2):
        for cat in self._score:
            if cat['category'] == category:
                for obj in cat['countries']:
                    if obj['country'] == code2:
                        print('Score from category {} | country {} | score {}'.format(
                            category, code2, obj['score']))
                        return obj['score']
        return 0.00001

    def printData(self, name_file):
        with open(name_file, 'w') as f:
            f.write('const data = ')
            json.dump(self._generated_dots, f)
            f.close()

    def init(self, val):
        self._default_dot = val
        print('\n'*40)
        print('Starting')
        if val == False:
            print('Plotting dots, but without default dots')
        self.getScore()
        self.getDefaultCountriesDots()
        self.generateDots()
        self.printData('data.json')
        print('Dots generated and saved in {} seconds \n\nSaved as:\tdata.json'.format(
            (time.time() - self.start)))


gen = generator()
if len(sys.argv) > 1:
    if 'default_dot=false' in sys.argv[1]:
        gen.init(False)
    else:
        gen.init(True)
else:
    gen.init(True)
