  var Shaders = {
    'earth' : {
      uniforms: {
        'texture': { type: 't', value: 0, texture: null }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'vUv = uv;',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          'vNormal = normalize( normalMatrix * normal );',
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
          //'gl_FragColor = vec4(vUv,0.,1.);',
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
    },
    'data' : {
      uniforms: {
        'texture': { type: 't', value: 0, texture: null },
        'textureData': { type: 't', value: 0, texture: null },
        'extrudeMin': { type: 'f', value: 0 },
        'extrudeMax': { type: 'f', value: 10 }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'uniform sampler2D textureData;',
        'uniform float extrudeMax;',

        'varying vec2 vUv;',

        'void main() {',
          'vUv = uv;',
          'vNormal = normalMatrix * normal;',
          'vec3 data = texture2D( textureData, vUv ).xyz;',
          'vec3 morphed = position-normal+ length(normal)*normalize(position) *data.r*extrudeMax;',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( morphed, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'uniform sampler2D textureData;',
        'uniform float extrudeMin;',
        'varying vec2 vUv;',
        'varying vec3 vNormal;',
        'void main() {',
          'vec4 data = texture2D( textureData, vUv );',
          'if (data.r < extrudeMin) discard;',
          'gl_FragColor = vec4( data.r,0.,1.-data.r, 1.0 );',
        '}'
      ].join('\n')
    }
  };