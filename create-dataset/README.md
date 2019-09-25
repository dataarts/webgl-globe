# Generating geographical points
`
Note: is necessary to have python 3.7+ python installed
`

- [Generating categories](#creating-categories-and-its-scores-for-countries)
- [Creating the dataset indeed](#creating-the-dataset-indeed)

### What is `countries-default.json`
This file contains all geolocation data to each country points.
Is important to note:

Every point in this file represents a city with a population of at least 10,000 people. ***This are not a rondomic points file.***

The pattern to this file is one array containing arrays, which the inner array's first position of all this one is the Alpha-2 code for each country, and the second position is another array with one array for each city (represented by latitude and longitude respectively)
Just like this:
```
[
  ["BR", [
    [-12.97111, -38.51083],
    [-23.5475, -46.63611],
    [-22.90278, -43.2075]
    ]
  ],
  ...
]
```

## Creating categories and its scores for countries
To create a geographical dataset is necessary to pay atenttion in `scores.json` default value.

This file accepts an array of objects wich receives 2 attributes: a category name and a countries array like that:
```
{
        "category": "A",
        "countries": [
          {
                "country": "BR",
                "score": 0.55
            },
            {
                "country": "CA",
                "score": 0.25
            },
            {
                "country": "US",
                "score": 0.15
            }
        ]
    }
```
***Note: is pretty important to follow this pattern!!!***

## Creating the dataset indeed
After updating the file scores.json with your categories, countries and scores data you have 2 alternatives to generate your dataset.
The first one will generate a large file plotting all countries in your graphic with a default score to improve the graphic' visual.
The second will generate points only the countries listed in your categories, will be a smaller file, but with large blank spaces in your graph.
### First option - With default values on countries that are not listed in your categories
This kind of graphic is normally used to plot distributions, and distributions are represented with percentages, furthermore `for visual purpose` is aceptable to plot a 0.001% score as default value for all non-listed countries.

Keeping it in your mind is and agreeding you can just open your terminal in this folder and type this command:
```
  python generate-dots.py
```
And you'll see a new file called `data.json` in this folder. This file is your dataset pre-configured, just copy it, paste it to your graphic folder and remind to call it on `index.html` with this tag:
```
  <script type="text/javascript" src="data.json"></script>
```

### Second option - Without default values on countries, only plot the countries listed in your scores.json

Is pretty easy, just open your terminal in this folder and type this command:
```
  python generate-dots.py default_dot=false
```
And you'll see a new file called `data.json` in this folder. This file is your dataset pre-configured, just copy it, paste it to your graphic folder and remind to call it on `index.html` with this tag:
```
  <script type="text/javascript" src="data.json"></script>
```