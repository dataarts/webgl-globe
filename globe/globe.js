/**
 * WebGL Framework
 * Released under Apache 2.0 License - http://www.apache.org/licenses/LICENSE-2.0.html
 */

var DAT = DAT || {};

DAT.globe = function(container, datasource, colorFn) {

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

  var overRenderer;

  var loader;

  var imgDir = 'http://inside-search.googlecode.com/svn/trunk/';

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 1500, distanceTarget = 1300;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

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

    container.addEventListener('mousewheel', onMouseWheel, false);

    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);

    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);


  }

  addData = function(data) {

    var lat, lng, size, color, c;

    points = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: THREE.FaceColors }));
    points.matrixAutoUpdate = false;
    scene.addObject(points);

    for (var i = 0, ll = data.length; i < ll; i += 3) {

        lat = data[i + 1];
        lng = data[i + 2];
        size = data[i];
        color = new THREE.Color();
        color.setHSV( ( 0.6 - ( size * 0.5 ) ), 1.0, 1.0 );

        addPoint(lat, lng, size * 200, color);

    }

  };

  function addPoint(lat, lng, size, color) {

    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.lookAt(mesh.position);

    point.scale.z = size;
    point.updateMatrix();

    var i;
    for (i = 0; i < point.geometry.faces.length; i++) {

      point.geometry.faces[i].color = color;

    }

    GeometryUtils.merge(points.geometry, point);

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

    distanceTarget = distanceTarget > 1500 ? 1500 : distanceTarget;
    distanceTarget = distanceTarget < 500 ? 500 : distanceTarget;

  }

  function animate() {

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

    if (vector.distanceTo(camera.position) == 0) {
      return;
    }
    vector.copy(camera.position);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(sceneAtmosphere, camera);

  }

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
    zoomContainer.style.width = padding/2+'px';
    zoomContainer.style.position = 'absolute';
    zoomContainer.style.marginLeft = (w-padding)+'px';
    zoomContainer.style.marginTop = padding+'px';

    var zoomIn = document.createElement('div');
    var zoomOut = document.createElement('div');

    var applyButtonStyles = function(elem) {
      elem.style.width = padding/2+'px';
      elem.style.height = padding/2+'px';
      elem.style.borderRadius = '3px';
      elem.style.marginBottom = '10px';
      elem.style.position = 'static';
      elem.style.cursor = 'pointer';
    }

    zoomIn.style.background = '#444 url('+imgDir+'zoom-in.png) center center ' +
        '' +
        'no-repeat';
    zoomOut.style.background = '#444 url('+imgDir+'zoom-out.png) center ' +
        '-11px no-repeat';

    applyButtonStyles(zoomIn);
    applyButtonStyles(zoomOut);

    var noZoom = function() {
      curZoomSpeed = 0;
      zoomIn.style.backgroundColor = '#444';
      zoomOut.style.backgroundColor = '#444';
    };

    zoomIn.addEventListener('mousedown', function() {
      curZoomSpeed = zoomSpeed;
      this.style.backgroundColor = '#666';
    }, false);

    zoomIn.addEventListener('mouseup', noZoom, false);

    zoomOut.addEventListener('mousedown', function() {
      curZoomSpeed = -zoomSpeed;
      this.style.backgroundColor = '#666';
    }, false);

    zoomOut.addEventListener('mouseup', noZoom, false);

    zoomContainer.appendChild(zoomIn);
    zoomContainer.appendChild(zoomOut);

    container.appendChild(zoomContainer);
    
  }

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

  init();

  addLoader();
//  addZoomers();

  animate();
  loadData();


};

