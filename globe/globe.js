var Shaders = {

	'earth' : {

		uniforms: {

			"texture": { type: "t", value: 0, texture: null }

		},

		vertexShader: [

			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"void main() {",

				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

				"vNormal = normalize( normalMatrix * normal );",
				"vUv = uv;",

			"}"

		].join("\n"),

		fragmentShader: [

			"uniform sampler2D texture;",

			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"void main() {",

				"vec3 diffuse = texture2D( texture, vUv ).xyz;",
				"float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );",
				"vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );",

				"gl_FragColor = vec4( diffuse + atmosphere, 1.0 );",

			"}"

		].join("\n")

	},

	'atmosphere' : {

		uniforms: {},

		vertexShader: [

			"varying vec3 vNormal;",

			"void main() {",

				"vNormal = normalize( normalMatrix * normal );",
				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

			"}"

		].join("\n"),

		fragmentShader: [

			"varying vec3 vNormal;",

			"void main() {",

				"float intensity = pow( 0.8 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 12.0 );",
				"gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;",

			"}"

		].join("\n")

	}

};

var container, stats;
var camera, scene, sceneAtmosphere, renderer;
var vector, mesh, atmosphere, point, points, pointsGeometry;

var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
var rotation = { x: 0, y: 0 }, target = { x: 0, y: 0 }, targetOnDown = { x: 0, y: 0 };
var distance = 1500, distanceTarget = 900;

var PI_HALF = Math.PI / 2;

init();
plotData();
animate();

function init() {

	container = document.getElementById( 'container' );

	camera = new THREE.Camera( 30, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = distance;

	vector = new THREE.Vector3();

	scene = new THREE.Scene();
	sceneAtmosphere = new THREE.Scene();

	// earth

	var geometry = new Sphere( 200, 40, 30 );

	var shader = Shaders[ 'earth' ];
	var uniforms = Uniforms.clone( shader.uniforms );

	uniforms[ 'texture' ].texture = ImageUtils.loadTexture( 'textures/world.jpg' );

	var material = new THREE.MeshShaderMaterial( {

		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	mesh = new THREE.Mesh( geometry, material );
	scene.addObject( mesh );

	// atmosphere

	var shader = Shaders[ 'atmosphere' ];
	var uniforms = Uniforms.clone( shader.uniforms );

	var material = new THREE.MeshShaderMaterial( {

		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	mesh = new THREE.Mesh( geometry, material );
	mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.1;
	mesh.flipSided = true;
	sceneAtmosphere.addObject( mesh );

	// point

	geometry = new Cube( 0.75, 0.75, 1 );

	for ( var i = 0; i < geometry.vertices.length; i ++ ) {

		var vertex = geometry.vertices[ i ];
		vertex.position.z += 0.5;

	}

	point = new THREE.Mesh( geometry );

	pointsGeometry = new THREE.Geometry();

	//

	renderer = new THREE.WebGLRenderer( /* { antialias: false } */ );
	renderer.autoClear = false;
	renderer.setClearColorHex( 0x000000, 1.0 );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container.appendChild( renderer.domElement );

	document.addEventListener( 'mousedown', onDocumentMouseDown, false );
	document.addEventListener( 'mousewheel', onDocumentMouseWheel, false );

	window.addEventListener( 'resize', onWindowResize, false );

}

function plotData() {

	var lat, lng, size, color;

	points = new THREE.Mesh( pointsGeometry, new THREE.MeshBasicMaterial( { color: 0xffffff, vertexColors: THREE.FaceColors } ) );

	for ( var i = 0, l = data.length; i < l; i ++ ) {

		lat = data[ i ][ 1 ];
		lng = data[ i ][ 2 ];
		size = data[ i ][ 0 ];
		color = new THREE.Color();
		color.setHSV( ( 0.6 - ( size * 0.5 ) ), 1.0, 1.0 );

		addPoint( lat, lng, size * 200, color  );

	}

	scene.addObject( points );

}

function addPoint( lat, lng, size, color ) {

	// if ( lat == 0 && lng == 0 ) return;

	var phi = ( 90 - lat ) * Math.PI / 180;
	var theta = ( 180 - lng ) * Math.PI / 180;

	// position

	point.position.x = 200 * Math.sin( phi ) * Math.cos( theta );
	point.position.y = 200 * Math.cos( phi );
	point.position.z = 200 * Math.sin( phi ) * Math.sin( theta );

	// rotation

	point.lookAt( mesh.position );

	// scaling

	point.scale.z = size;
	point.updateMatrix();

	// color

	for ( var i = 0; i < point.geometry.faces.length; i ++ ) {

		point.geometry.faces[ i ].color = color;

	}

	console.log( point );

	GeometryUtils.merge( pointsGeometry, point );

}

function onDocumentMouseDown( event ) {

	event.preventDefault();

	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );
	document.addEventListener( 'mouseout', onDocumentMouseOut, false );

	mouseOnDown.x = - event.clientX;
	mouseOnDown.y = event.clientY;

	targetOnDown.x = target.x;
	targetOnDown.y = target.y;

	container.style.cursor = 'move';

}

function onDocumentMouseMove( event ) {

	mouse.x = - event.clientX;
	mouse.y = event.clientY;

	target.x = targetOnDown.x + ( mouse.x - mouseOnDown.x ) * 0.005;
	target.y = targetOnDown.y + ( mouse.y - mouseOnDown.y ) * 0.005;

	target.y = target.y > PI_HALF ? PI_HALF : target.y;
	target.y = target.y < - PI_HALF ? - PI_HALF : target.y;

}

function onDocumentMouseUp( event ) {

	document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
	document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
	document.removeEventListener( 'mouseout', onDocumentMouseOut, false );

	container.style.cursor = 'auto';

}

function onDocumentMouseOut( event ) {

	document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
	document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
	document.removeEventListener( 'mouseout', onDocumentMouseOut, false );

}

function onDocumentMouseWheel( event ) {

	distanceTarget -= event.wheelDeltaY * 0.3;

	distanceTarget = distanceTarget > 1500 ? 1500 : distanceTarget;
	distanceTarget = distanceTarget < 500 ? 500 : distanceTarget;


}

function onWindowResize( event ) {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	requestAnimationFrame( animate );
	render();

}

function render() {

	rotation.x += ( target.x - rotation.x ) * 0.05;
	rotation.y += ( target.y - rotation.y ) * 0.05;
	distance += ( distanceTarget - distance ) * 0.05;

	camera.position.x = distance * Math.sin( rotation.x ) * Math.cos( rotation.y );
	camera.position.y = distance * Math.sin( rotation.y );
	camera.position.z = distance * Math.cos( rotation.x ) * Math.cos( rotation.y );

	/*
	// Do not render if camera hasn't moved.

	if ( vector.distanceTo( camera.position ) == 0 ) {

		return;

	}

	vector.copy( camera.position );
	*/

	renderer.clear();
	renderer.render( scene, camera );
	renderer.render( sceneAtmosphere, camera );

}
