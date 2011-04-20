// Copyright 2011 Google Inc. All Rights Reserved

/**
 * @fileoverview WebGL Globe
 * @author ricardocabello@google.com (Ricardo Cabello)
 * @author amitp@google.com (Amit Patel)
 */

var DAT = DAT || {};

/**
 * Create a webgl globe with given data and color mapping
 * Requires Three.js version from:
 *  http://inside-search.googlecode.com/svn/trunk/Three.js
 *  originally from:
 *  https://github.com/mrdoob/three.js/
 * @param {Element} container dom element to be attached to
 * @param {Array} data repeat |0-1 float, latitude, longitude, color index|
 * @param {Array.<hex>} colors
 */
DAT.globe = function(container, datasource, colors) {

  colors = colors || [
    0xd9d9d9, 0xb6b4b5, 0x9966cc, 0x15adff, 0x3e66a3,
    0x216288, 0xff7e7e, 0xff1f13, 0xc0120b, 0x5a1301, 0xffcc02,
    0xedb113, 0x9fce66, 0x0c9a39,
    0xfe9872, 0x7f3f98, 0xf26522, 0x2bb673, 0xd7df23,
    0xe6b23a, 0x7ed3f7];

  /**
   * GL Shader functions for glow of earth and atmosphere
   */
  var Shaders = {

    'earth' : {

      uniforms: {

        'texture': { type: 't', value: 0, texture: null }

      },

      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',

        'void main() {',

        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        'vNormal = normalize( normalMatrix * normal );',
        'vUv = uv;',

        '}'
      ].join('\n'),

      fragmentShader: [
        'uniform sampler2D texture;',

        'varying vec3 vNormal;',
        'varying vec2 vUv;',

        'void main() {',

        'vec3 diffuse = texture2D( texture, vUv ).xyz;',
        'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
        'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',

        'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',

        '}'
      ].join('\n')

    },

    'atmosphere' : {

      uniforms: {},

      vertexShader: [
        'varying vec3 vNormal;',

        'void main() {',

        'vNormal = normalize( normalMatrix * normal );',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        '}'
      ].join('\n'),

      fragmentShader: [
        'varying vec3 vNormal;',

        'void main() {',

        'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
        'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',

        '}'
      ].join('\n')

    }

  };

  var camera, scene, sceneAtmosphere, renderer, w, h;
  var vector, mesh, atmosphere, point, points;

  var loader; // div that the loading message goes in

  // Just cause this has been moving around a lot ...
  var imgDir = 'http://inside-search.googlecode.com/svn/trunk/';

  var curZoomSpeed = 0; // So you can hold down the zoom buttons.
  var zoomSpeed = 50; // How fast we go when we hold down zoom.

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI, y: Math.PI / 5.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 1500, distanceTarget = 1300;
  var padding = 40; // for div elements that get appended to container
  var PI_HALF = Math.PI / 2;

  /**
   * Initialize the webgl earth
   */
  function init() {

    // Setup some default styles so we don't have to go appending
    // redundant css everywhere
    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;


    camera = new THREE.Camera(
        30, w / h, 1, 10000);
    camera.position.z = distance;

    vector = new THREE.Vector3();

    scene = new THREE.Scene();
    sceneAtmosphere = new THREE.Scene();

    // earth

    var geometry = new THREE.Sphere(200, 40, 30);

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms['texture'].texture = THREE.ImageUtils.loadTexture(imgDir+'world' +
        '.jpg');

    material = new THREE.MeshShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader

        });

    mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    scene.addObject(mesh);

    // atmosphere

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.MeshShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader

        });

    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.1;
    mesh.flipSided = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    sceneAtmosphere.addObject(mesh);

    // point

    // geometry = new THREE.Cube(0.75, 0.75, 1);
    geometry = new THREE.Cube(0.75, 0.75, 1, 1, 1, 1, null, false, { px: true,
          nx: true, py: true, ny: true, pz: true, nz: false});

    for (var i = 0; i < geometry.vertices.length; i++) {

      var vertex = geometry.vertices[i];
      vertex.position.z += 0.5;

    }

    point = new THREE.Mesh(geometry);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.autoClear = false;
    renderer.setClearColorHex(0x000000, 0.0);
    renderer.setSize(w, h);

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', onMouseDown, false);

    // For now ...
    //container.addEventListener('mousewheel', onMouseWheel, false);

    document.addEventListener('keydown', onDocumentKeyDown, false);

    //window.addEventListener('resize', onWindowResize, false);

  }

  /**
   * Load additional data
   * @param  data
   */
  addData = function(data) {

    var lat, lng, size, color, c;

    points = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: THREE.FaceColors }));
    points.matrixAutoUpdate = false;
    scene.addObject(points);

    for (var lang in data) {
      for (var i = 0, ll = data[lang].length; i < ll; i += 3) {

        lat = data[lang][i + 1];
        lng = data[lang][i + 2];
        size = data[lang][i];
        color = new THREE.Color(colors[lang] || 0xffffff);

        addPoint(lat, lng, size * 200, color);

      }
    }

  };

  /**
   * Add a point to points geometry
   * @param lat
   * @param lng
   * @param size
   * @param color
   */
  function addPoint(lat, lng, size, color) {

    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    // position

    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    // rotation

    point.lookAt(mesh.position);

    // scaling

    point.scale.z = size;
    point.updateMatrix();

    // color

    var i;
    for (i = 0; i < point.geometry.faces.length; i++) {

      point.geometry.faces[i].color = color;

    }

    GeometryUtils.merge(points.geometry, point);

  }

  /**
   * Make world draggable.
   * @param event
   */
  function onMouseDown(event) {

    event.preventDefault();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    container.style.cursor = 'move';

  }

  /**
   * Drag the world.
   * @param event
   */
  function onMouseMove(event) {

    mouse.x = - event.clientX;
    mouse.y = event.clientY;

    var zoomDamp = distance/1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < - PI_HALF ? - PI_HALF : target.y;

  }

  /**
   * Stop being draggable.
   * @param event
   */
  function onMouseUp(event) {

    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);

    container.style.cursor = 'auto';

  }

  /**
   * Remove event listeners when not in focus.
   * @param event
   */
  function onMouseOut(event) {

    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);

  }

  /**
   * Zoom with mouse wheel
   * @param event
   */
  function onMouseWheel(event) {

    zoom(event.wheelDeltaY * 0.3);

  }

  /**
   * Zoom with arrow keys
   * @param event
   */
  function onDocumentKeyDown(event) {

    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }

  }

  /**
   * Zoom to specified distance
   * @param delta
   */
  function zoom(delta) {

    distanceTarget -= delta;

    distanceTarget = distanceTarget > 1500 ? 1500 : distanceTarget;
    distanceTarget = distanceTarget < 500 ? 500 : distanceTarget;

  }

  /**
   * Animate the world
   */
  function animate() {

    requestAnimationFrame(animate);
    render();

  }

  /**
   * Render the scene with the supplied camera
   */
  function render() {

    zoom(curZoomSpeed);

    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    // Do not render if camera hasn't moved.
    if (vector.distanceTo(camera.position) == 0) {
      return;
    }
    vector.copy(camera.position);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(sceneAtmosphere, camera);

  }

  /**
   * Add a loader animated gif overlaid
   */
  function addLoader() {
    var text = '<img src="'+imgDir+'loader.gif" /> Loading Data';
    loader = document.createElement('div');
    loader.innerHTML = text;
    loader.style.position = 'absolute';
    loader.style.margin = padding+'px';
    container.appendChild(loader);
  }

  function removeLoader() {
    container.removeChild(loader);
  }

  function addZoomers() {

    var zoomContainer = document.createElement('div');
    zoomContainer.style.width = padding+'px';
    zoomContainer.style.position = 'absolute';
    zoomContainer.style.marginLeft = (w-padding*2)+'px';
    zoomContainer.style.marginTop = padding+'px';

    var zoomIn = document.createElement('div');
    var zoomOut = document.createElement('div');

    var applyButtonStyles = function(elem) {
      elem.style.width = padding+'px';
      elem.style.height = padding+'px';
      elem.style.borderRadius = '4px';
      elem.style.marginBottom = '10px';
      elem.style.position = 'static';
      elem.style.backgroundColor = '#eee';
      elem.style.cursor = 'pointer';
    }

    zoomIn.style.backgroundImage = 'url('+imgDir+'zoom-in.png)';
    zoomOut.style.backgroundImage = 'url('+imgDir+'zoom-out.png)';

    applyButtonStyles(zoomIn);
    applyButtonStyles(zoomOut);

    var noZoom = function() {
      curZoomSpeed = 0;
    };

    zoomIn.addEventListener('mousedown', function() {
      curZoomSpeed = zoomSpeed;
    }, false);

    zoomIn.addEventListener('mouseup', noZoom, false);

    zoomOut.addEventListener('mousedown', function() {
      curZoomSpeed = -zoomSpeed;
    }, false);

    zoomOut.addEventListener('mouseup', noZoom, false);

    zoomContainer.appendChild(zoomIn);
    zoomContainer.appendChild(zoomOut);

    container.appendChild(zoomContainer);
    
  }


  /**
   * Load file
   * then append to DAT.globe
   */
  function loadData() {
    var xhr;
    xhr = new XMLHttpRequest();
    xhr.open('GET', datasource, true);
    xhr.onreadystatechange = function(e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          addData(JSON.parse(xhr.responseText));
          removeLoader();
        }
      }
    };
    xhr.send(null);
  }

  /**
   * Append DAT credentials
   */

  function addCredits() {
    var text = document.createElement('span');
    text.innerHTML = 'The <strong>WebGL Globe</strong> is a simple, open plat' +
        'form for visualizing geographic data in WebGL-compatible browsers li' +
        'ke Google Chrome.<br />Learn more about the globe and get the code at';
    text.innerHTML = "The <strong>WebGL Globe</strong> is a simple, open platform for visualizing geographic data in WebGL-compatible browsers like Google Chrome.<br />Learn more about the globe and get the code at ";


    var link = document.createElement('a');
    link.innerHTML = 'www.chromeexperiments.com/globe';
    link.setAttribute('href', 'http://chromeexperiments.com/globe/');
    link.style.color = '#0080ff';

    var credits = document.createElement("div");

    credits.appendChild(text);
    credits.appendChild(link);

    credits.style.position = 'absolute';
    credits.style.paddingBottom = padding+'px';
    credits.style.textAlign = 'center';
    credits.style.width = w + 'px';
    container.appendChild(credits);
    credits.style.marginTop = (h - credits.offsetHeight)+'px';
  }

  init();

  addLoader();
  addZoomers();
  addCredits();

  animate();
  loadData();


};

