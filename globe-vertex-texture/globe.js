/**
 * dat.globe Javascript WebGL Globe Toolkit
 * http://dataarts.github.com/dat.globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container, colorFn) {

  colorFn = colorFn || function(x) {
    var c = new THREE.Color();
    c.setHSV( ( 0.6 - ( x * 0.5 ) ), 1.0, 1.0 );
    return c;
  };

  var camera, scene, sceneAtmosphere, renderer, w, h;
  var vector, mesh, atmosphere, point;

  var pointGeo, pointModel, gridGeo, gridModel;
  var gridDensity = 6; // 0-10
  var pointType = 'hex'; // cube || hex || sphere
  var pointScale = 1.1;
  var pointExtrudeRange = [0.01,100];

  gridModel = 'models/gridLand'+gridDensity+'.js';
  if (pointType == 'cube') pointModel = "models/cube.js";
  else if (pointType == 'hex') pointModel = "models/hex.js";
  else pointModel = "models/sphere.js";

  var overRenderer;

  var imgDir = './';

  var curZoomSpeed = 0;

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 100000, distanceTarget = 100000;

  var PI_HALF = Math.PI / 2;

  function modelLoader() {
    loader = new THREE.JSONLoader();
    loader.load({ model:pointModel, callback: function(g) {
      pointGeo = g;
      gridLoader()
    }});
  }
  function gridLoader() {
    loader = new THREE.JSONLoader();
    loader.load({ model: gridModel, callback: function(g) {
      gridGeo = g;
      init();
      createPoints();
    }});
  }

  function init() {

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

    var geometry = new THREE.Sphere(200, 40, 30);

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms['texture'].texture = THREE.ImageUtils.loadTexture(imgDir+'world' + '.jpg');

    material = new THREE.MeshShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader

        });

    mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    scene.addObject(mesh);

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

    point = new THREE.Mesh(pointGeo);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.autoClear = false;
    renderer.setClearColorHex(0x000000, 0.0);
    renderer.setSize(w, h);

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', onMouseDown, false);

    container.addEventListener('mousewheel', onMouseWheel, false);

    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);

    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);

    animate();
  }

  function createPoints() {

    var subgeo = new THREE.Geometry();
    console.log(gridGeo);

    for (i = 0; i < gridGeo.vertices.length; i ++) {
      var x = gridGeo.vertices[i].position.x;
      var y = gridGeo.vertices[i].position.y;
      var z = gridGeo.vertices[i].position.z;


     var r;
     var theta;
     var phi;
       theta = Math.acos(y/200)/Math.PI;
       phi = ((Math.atan2(z,-x))+Math.PI)/(Math.PI*2);
        addPoint(x,y,z,phi,theta, subgeo);
    }

    if (pointType == ('sphere')){
      subgeo.computeCentroids();
      subgeo.computeFaceNormals();
      subgeo.computeVertexNormals();
    }

    this._baseGeometry = subgeo;

    this.shader = Shaders['data'];
    this.uniforms = THREE.UniformsUtils.clone(this.shader.uniforms);

    this.uniforms['texture'].texture = THREE.ImageUtils.loadTexture(imgDir+'worldMask' + '.jpg');
    this.uniforms['textureData'].texture = THREE.ImageUtils.loadTexture(imgDir+'worldDataSample' + '.jpg');
    this.uniforms['extrudeMin'].value = pointExtrudeRange[0];
    this.uniforms['extrudeMax'].value = pointExtrudeRange[1];

    this.material = new THREE.MeshShaderMaterial({

          uniforms: this.uniforms,
          vertexShader: this.shader.vertexShader,
          fragmentShader: this.shader.fragmentShader,
          color: 0xffffff,
          vertexColors: THREE.FaceColors

        });

    this.points = new THREE.Mesh(this._baseGeometry, this.material);
    this.points.doubleSided = false;
    scene.addObject(this.points);
  }

  function addPoint(x,y,z,u,v, subgeo) {

    point.position.x = x;
    point.position.y = y;
    point.position.z = z;

    point.scale.set(pointScale, pointScale, 1);

    point.lookAt(mesh.position);

    point.updateMatrix();

    var i,j;
    for (i = 0; i < point.geometry.faces.length; i++) {

      for (j = 0; j < point.geometry.faces[i].vertexNormals.length; j++) {

        var len = point.geometry.faces[i].vertexNormals[j].length();
        point.geometry.faces[i].vertexNormals[j] = new THREE.Vector3(x/200*len,y/200*len,z/200*len);

      }

    }
    for (i = 0; i < point.geometry.faceVertexUvs[0].length; i++) {

      for (j = 0; j < point.geometry.faceVertexUvs[0][i].length; j++) {
         point.geometry.faceVertexUvs[0][i][j] = new THREE.UV( u,v );
      }

    }
    GeometryUtils.merge(subgeo, point);
  }

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

  function onMouseMove(event) {
    mouse.x = - event.clientX;
    mouse.y = event.clientY;

    var zoomDamp = distance/1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < - PI_HALF ? - PI_HALF : target.y;
  }

  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';
  }

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
  }

  function onMouseWheel(event) {
    event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3);
    }
    return false;
  }

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

  function onWindowResize( event ) {
    console.log('resize');
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
  }

  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
  }

  function animate () {
    requestAnimationFrame(animate);
    render();
  }

  function render() {
    zoom(curZoomSpeed);

    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    vector.copy(camera.position);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(sceneAtmosphere, camera);
  }

  this.createPoints = createPoints;
  this.renderer = renderer;
  this.scene = scene;
  this.animate = animate;
  this.modelLoader = modelLoader;

  return this;

};

