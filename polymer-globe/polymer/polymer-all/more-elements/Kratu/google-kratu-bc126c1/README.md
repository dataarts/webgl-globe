Kratu
=====
> Kratu is an Open Source client-side analysis framework to create simple yet powerful renditions of data. It allows you to dynamically adjust your view of the data to highlight issues, opportunities and correlations in the data.

> [Kratu is a Sanskrit word](http://spokensanskrit.de/index.php?tinput=kratu&script=&direction=SE&link=yes) and means enlightenment, understanding and intelligence.

It can compare similar objects by calculating individual scores for all the features we care about.
Each feature is highlighted according to their score, rendering a prioritized heatmap where the objects of most significance float to the top.

**Have a look at our [tutorial](http://google.github.com/kratu/tutorial/) and dive straight into the deep end, or read on for a more gentle introduction.**

You can use Kratu to analyze data for support queue prioritization, account quality optimization, performance analysis, product comparison and much more.
![Example Kratu Report](http://google.github.com/kratu/img/tut_finalreport.png)

## Installation
Simply [download Kratu](https://github.com/google/kratu/archive/master.zip) and extract, or check out the repository:
```
$ git clone https://github.com/google/kratu.git
```
*Note: If you're running Kratu locally, you might have to start your browser with a flag to allow local file loading.*
*If you're using Chrome, use --allow-file-access-from-files*

## Quick start
If you want to see more of what Kratu can do, have a look at the [examples included](https://github.com/google/kratu/tree/master/examples).

Otherwise, here's a quick look at how to render a simple report
```javascript
// Instantiate a new Kratu object
var kratu = new Kratu();

// Set the data we'd like to render
kratu.setEntities(data);

// Tell Kratu where to render our report
kratu.setRenderElement( document.getElementById('kratuReport') );

// And render it!
kratu.renderReport();
```

## In-depth tutorial
To get a better understanding of what Kratu has to offer, go through [this in-depth tutorial](http://google.github.com/kratu/tutorial/), where we'll build a [product comparison analysis](https://github.com/google/kratu/tree/master/examples/spaceshipselector) that can help users figure out which spaceship to buy.

## Fine print
Pull requests are very much appreciated. Please sign the [Google Code contributor license agreement](http://code.google.com/legal/individual-cla-v1.0.html) (There is a convenient online form) before submitting.

<dl>
  <dt>Author</dt><dd><a href="https://plus.google.com/115142215538295075810">Tarjei Vassbotn (Google Inc.)</a></dd>
  <dt>Copyright</dt><dd>Copyright © 2013 Google, Inc.</dd>
  <dt>License</dt><dd>Apache 2.0</dd>
  <dt>Limitations</dt><dd>Only tested on the latest versions of browsers. Expect it to fail on older versions.</dd>
</dl>
