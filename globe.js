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

  var camera, scene, sceneAtmosphere, renderer;
  var vector, mesh, atmosphere, point, points;

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI, y: Math.PI/5.0 },
      targetOnDown = { x: 0, y: 0 };
  var distance = 1500, distanceTarget = 1300;

  var PI_HALF = Math.PI / 2;

  /**
   * Initialize the webgl earth
   */
  function init() {

    var shader, uniforms, material;
    var w = container.offsetWidth || window.innerWidth,
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

    uniforms['texture'].texture = THREE.ImageUtils.loadTexture('http://inside-search.googlecode.com/svn/trunk/world.jpg');

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

//    geometry = new THREE.Cube(0.75, 0.75, 1);
    geometry = new THREE.Cube( 0.75, 0.75, 1, 1, 1, 1, null, false, { px: true, nx: true, py: true, ny: true, pz: true, nz: false} );

    for (var i = 0; i < geometry.vertices.length; i++) {

      var vertex = geometry.vertices[i];
      vertex.position.z += 0.5;

    }

    point = new THREE.Mesh(geometry);

    //

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.autoClear = false;
    renderer.setClearColorHex(0x000000, 0.0);
    renderer.setSize(w, h);

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mousewheel', onMouseWheel, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

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

        lat = data[lang][i+1];
        lng = data[lang][i+2];
        size = data[lang][i];
        color = new THREE.Color( colors[lang] || 0xffffff );

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

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005;

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

    switch(event.keyCode) {
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
   * Handle window resize
   * @param event
   */
  function onWindowResize(event) {

    /*
    var w = container.offsetWidth || window.innerWidth,
    h = container.offsetHeight || window.innerHeight;
    */
    var w = 960, h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    
    div = document.getElementById("DAT-info");
    var t = renderer.domElement.offsetTop + h - (div.offsetHeight + div.style.paddingTop + div.style.paddingBottom);
    var l = renderer.domElement.offsetLeft;
    div.style.left = l + "px";
    div.style.top = t + "px";

    renderer.setSize(w, h);
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

    rotation.x += (target.x - rotation.x) * 0.05;
    rotation.y += (target.y - rotation.y) * 0.05;
    distance += (distanceTarget - distance) * 0.05;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    // Do not render if camera hasn't moved.
    if ( vector.distanceTo( camera.position ) == 0 ) {
      return;
    }
    vector.copy( camera.position );

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(sceneAtmosphere, camera);

  }

  init();
  animate();

  /**
   * Add a loader animated gif overlaid
   */
  function addLoader() {
    var text = '<img src="data:image/gif;base64,R0lGODlhEAAQAPIAAAAAAP///zw8PLy8vP///5ycnHx8fGxsbCH/C05FVFNDQVBFMi4wAwEAAAAh\n/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAEAAQAAADMwi63P4wyklr\nE2MIOggZnAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQJCgAAACwAAAAA\nEAAQAAADNAi63P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUk\nKhIAIfkECQoAAAAsAAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9\nHMaoKwJZ7Rf8AYPDDzKpZBqfvwQAIfkECQoAAAAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYum\nCYUhDAQxRIdhHBGqRoKw0R8DYlJd8z0fMDgsGo/IpHI5TAAAIfkECQoAAAAsAAAAABAAEAAAAzII\nunInK0rnZBTwGPNMgQwmdsNgXGJUlIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQJCgAA\nACwAAAAAEAAQAAADMwi6IMKQORfjdOe82p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJ\nibufbSlKAAAh+QQJCgAAACwAAAAAEAAQAAADMgi63P7wCRHZnFVdmgHu2nFwlWCI3WGc3TSWhUFG\nxTAUkGCbtgENBMJAEJsxgMLWzpEAACH5BAkKAAAALAAAAAAQABAAAAMyCLrc/jDKSatlQtScKdce\nCAjDII7HcQ4EMTCpyrCuUBjCYRgHVtqlAiB1YhiCnlsRkAAAOwAAAAAAAAAAAA==" /> Loading Data';
    div = document.createElement('div');
    div.setAttribute('id', 'DAT-loader');
    div.innerHTML = text;
    container.appendChild(div);
    var padding = 40;
    var t = renderer.domElement.offsetTop + padding;
    var l = renderer.domElement.offsetLeft + padding;
    div.setAttribute('style', 'z-index: 100; font: 500 13px/17px sans-serif; color: #fff; position: absolute; top: '+t+'px; left: '+l+'px;')
  }

  function removeLoader() {
    div = document.getElementById('DAT-loader');
    container.removeChild(div);
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
  addLoader();
  loadData(); // Ready for the automating

  /**
   * Append DAT credentials
   */
   var div;
   function appendCredits() {
     var text = "The <strong>WebGL Globe</strong> is a simple, open platform for visualizing geographic data in WebGL-compatible browsers like Google Chrome.<br />Learn more about the globe and get the code at <a href = 'http://chromeexperiments.com/globe/'>www.chromeexperiments.com/globe</a>."
     div = document.createElement("div");
     div.setAttribute("id", "DAT-info");
     div.innerHTML = text;
     container.appendChild(div);
     var padding = 40;
     var t = renderer.domElement.offsetTop + renderer.domElement.offsetHeight - (div.offsetHeight + padding * 2);
     var l = renderer.domElement.offsetLeft;
     var styling = "#DAT-info { font: 500 13px/17px sans-serif; color: #fff; position: absolute; left: "+l+"px; top: "+t+"px; width: 880px; padding: "+padding+"px; } #DAT-info a { color: #0080ff; }";
     var style = document.createElement("style");
         style.setAttribute("type", "text/css");
         style.innerHTML = styling;
     document.getElementsByTagName("head")[0].appendChild(style);
   }
   appendCredits();

};

