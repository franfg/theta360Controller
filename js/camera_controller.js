var _camera_controller = function(divId,myRot) {
	var self = this;
  
	//variables
	var renderer, scene, camera;
	var videoRenderElement, videoImage, videoImageContext, videoTexture;
	var cameraControls;
	var controlsBlocked=false;
	var sizeWidth, sizeHeight;
	
	var rmin= 0.2, rmax= 0.4;
	var mapFunction;
	var funciones = [ uvRegularMap, uvUpDownMap, uvPowerMap, uvCircularMap, uvSphericMap ];
	var resolucion = 100;
	var pantalla = [];
	var pantallaActiva = 0;
	var myDiv;
	var defaultRotation=0;
	
	init(divId,myRot);

	function init(divId,myRot) {
		var container, mesh;
		var winWidth = window.innerWidth;
		var winHeight = window.innerHeight;
		myDiv=divId;
		defaultRotation=myRot;
		
		//obtener tamanyo del contenedor, y calcular proporcion
		sizeWidth=document.getElementById(divId).clientWidth;
		sizeHeight=document.getElementById(divId).clientHeight;
		var aspectRatio = sizeWidth/sizeHeight;
		
		//configurar contenedor y escena
		container = document.getElementById(divId);
		scene = new THREE.Scene();
		
		//renderizador
		renderer = new THREE.WebGLRenderer();
		renderer.setSize(sizeWidth, sizeHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setClearColor(new THREE.Color(0x000000));
		container.appendChild(renderer.domElement);
		
		// camara
		camera = new THREE.PerspectiveCamera(45, aspectRatio, 1, 100000);
		camera.target = new THREE.Vector3( 0, 0, 0 );
		camera.position.set( 0, 0, 3 );
		//camera.fov = 1270;
		
		//preparar la textura  de la salida de la videocamara, y los diferentes tipos de pantalla
		prepareVideoOutput();
		
		//configurar el controlador de la camara
		cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
		cameraControls.target.set(0, 0, 0);
		cameraControls.enableZoom = false;
		
		//configurar las proporciones
		//window.addEventListener( 'resize', updateAspectRatio, false );
		updateAspectRatio();
		
		cameraControls.customZoom=40;
		cameraControls.update();
		cameraControls.reset();
		cameraControls.update();
		cameraControls.rotateLeft( defaultRotation );
		cameraControls.update();
	}
	
	//funcion externa que devuelve el id del div contenedor
	this.getMyDiv = function(){
		return myDiv;
	}
	
	//funcion externa que devuelve el nivel de zoom
	this.getCustomZoom = function(){
		return cameraControls.customZoom;
	}
	
	//funcion externa que cambia el zoom de la camara
	this.setCustomZoom = function(zoomLvl){
		var newZoom= Math.max( 3, Math.min( 75, zoomLvl ) );
		cameraControls.customZoom=newZoom;
	}
	
	//funcion externa que permite cambiar la fuente externa de la videocamara, a traves de una url
	this.setVideoSrc = function(url){
		videoRenderElement.src = url;
		videoRenderElement.play();
		startAnimate();
		updateAspectRatio();
	}
	
	//funcion externa que permite cambiar el tipo de pantalla en la que se proyecta la videotextura
	this.updateVideoScreen = function(map){
		var formaPantalla = map-1;
		for (var i = 0; i < pantalla.length; i++) {
			pantalla[i].visible = false;
		};
		pantalla[formaPantalla].visible = true;
		cameraControls.reset();
		if(formaPantalla==2){
			cameraControls.enabled = false;
			cameraControls.customZoom=3;
		}else{
			cameraControls.enabled = true;
			cameraControls.customZoom=40;
			cameraControls.update();
			cameraControls.rotateLeft( defaultRotation );
		}
	}
	
	//funcion externa que permite pausar la videotextura
	this.pauseVideo = function(){
		if (videoRenderElement) {
			videoRenderElement.pause();
			videoRenderElement.src = null;
		}
	}
	
	function prepareVideoOutput(){
		var n = resolucion;
		if (!videoRenderElement) {//si no existe, crear el elemento que contendra la salida de la videocamara para dibujarla en la videotextura
			videoRenderElement = document.createElement('video');
		}
		videoImage =  document.createElement('canvas');
		videoImage.width = 1920;//theta resolution: 1280x720 (https://theta360.com/es/about/theta/s.html)
		videoImage.height = 1080;
		
		// context
		videoImageContext = videoImage.getContext('2d');
		videoImageContext.fillStyle = '#0000FF';
		videoImageContext.fillRect( 0, 0, videoImage.width, videoImage.height);
		
		//base texture
		videoTexture = new THREE.Texture( videoImage );
		videoTexture.minFilter = THREE.LinearFilter;
		videoTexture.magFilter = THREE.LinearFilter;
		
		var movieMaterial = new THREE.MeshBasicMaterial({
			map: videoTexture,
			overdraw: true,
			side: THREE.DoubleSide
		});
		    
		//-------------------->  Pantallas
		
		//Pantalla 1: Proyeccion en esfera de la salida cruda (ojo de pez), que necesita de fuerte correccion de distorsion
		var sphereGeom1 = new THREE.SphereGeometry(100, n, n);
		sphereGeom1.scale(-1, 1, 1);
		//correccion de la distorsion
		var anchuraRaw=1920;//tamanyo de la imagen doble fisheye en crudo
		var alturaRaw=1080;
		var radioCorreccion=433;//radio de la esfera del fisheye en la imagen cruda
		var centroEsfera1=480;
		var centroEsfera2=1440;
		var centroAlturaEsferas=600;
		
		var faceVertexUvs = sphereGeom1.faceVertexUvs[ 0 ];// cogemos los UVs de cada cara de la esfera
		for ( i = 0; i < faceVertexUvs.length; i++ ) {// para cada cara de la esfera(que contiene 3 vertices):
			var uvs = faceVertexUvs[ i ]; //cogemos los UVs de sus tres vertices(cada UV es un vector con 2 elementos[X e Y] con las coordenadas de la textura), que se modificaran para eliminar la distorsion
			var face = sphereGeom1.faces[ i ]; //cogemos la cara en si (clase Face3 en Three.js) -> https://threejs.org/docs/#api/core/Face3
			for ( var j = 0; j < 3; j ++ ) {//para cada vertice de la cara:
				var x = face.vertexNormals[ j ].x;
				var y = face.vertexNormals[ j ].y;//cogemos las coordenadas de su normal(que indica hacia donde mira la cara)
				var z = face.vertexNormals[ j ].z;
				//aplicamos la formula de correccion
				if (i < faceVertexUvs.length / 2) {//---Si pertenece a la primera semiesfera
					var correction = (x == 0 && z == 0) ? 1 : (Math.acos(y) / Math.sqrt(x * x + z * z)) * (2 / Math.PI);
					uvs[ j ].x = x * (radioCorreccion / anchuraRaw) * correction + (centroEsfera1 / anchuraRaw);
					uvs[ j ].y = z * (radioCorreccion / alturaRaw) * correction + (centroAlturaEsferas / alturaRaw);
				} else {			//---Si pertenece a la segunda semiesfera
					var correction = ( x == 0 && z == 0) ? 1 : (Math.acos(-y) / Math.sqrt(x * x + z * z)) * (2 / Math.PI);
					uvs[ j ].x = -1 * x * (radioCorreccion / anchuraRaw) * correction + (centroEsfera2 / anchuraRaw);
					uvs[ j ].y = z * (radioCorreccion / alturaRaw) * correction + (centroAlturaEsferas / alturaRaw);
				}
			}
		}
		sphereGeom1.rotateZ(-Math.PI / 2);//la imagen cruda en ojo de pez esta girada 90 grados, por lo que debemos rotar la esfera
		var sphere1 = new THREE.Mesh(
		  sphereGeom1,
		  movieMaterial
		);
		
		//Pantalla 2: Proyeccion en esfera de la salida equirectangular
		var sphereGeom2 = new THREE.SphereGeometry(100, n, n);
		sphereGeom2.scale(-1, 1, 1);
		var sphere2 = new THREE.Mesh(
		  sphereGeom2,
		  movieMaterial
		);
		
		//Pantalla 3: Proyeccion en un plano de la salida equirectangular
		var plano = new THREE.Mesh( new THREE.PlaneBufferGeometry( 4, 2, n, n ), movieMaterial);
		
		//guardar las pantallas en una lista
		pantalla.push( sphere2 );
		pantalla.push( sphere1 );
		pantalla.push( plano );
		
		pantalla[0].position.y = -25;
		pantalla[1].position.y = -25;
		pantalla[2].position.y = 0;
		
		//añadir los posibles tipos de pantalla a la escena
		for (var i = 0; i < pantalla.length; i++) {
			scene.add( pantalla[i] );
			pantalla[i].visible = false;
		};
		pantalla[0].visible = true;
	}
	
	//Actualizar las proporciones y el tamaño de la proyeccion
	function updateAspectRatio() {
		renderer.setSize(sizeWidth, sizeHeight);
		camera.aspect = sizeWidth/sizeHeight;
		camera.updateProjectionMatrix();
	}
	
	function startAnimate(){
		animate();
	}
	
	function animate(){
		requestAnimationFrame( animate );
		update();
		cameraControls.update();
		renderer.render(scene, camera);
	}
	
	function update(){
		videoImageContext.drawImage( videoRenderElement, 0, 0, videoImage.width, videoImage.height );
		if ( videoTexture ) {
			videoTexture.needsUpdate = true;
		}
	}
  
    function uvRegularMap(i,j,n){
      // Funcion de mapeo de de coordenadas uvs,
      // dado el vertice i,j indica que coordenada de textura le corresponde
      return new THREE.Vector2( j/n , (n-i)/n ) 
    }
    function uvUpDownMap(i,j,n){
      // Funcion de mapeo de de coordenadas uvs,
      // dado el vertice i,j indica que coordenada de textura le corresponde
      return new THREE.Vector2( j/n , i/n ) 
    }
    function uvPowerMap(i,j,n){
      // Funcion de mapeo de de coordenadas uvs,
      // dado el vertice i,j indica que coordenada de textura le corresponde
      var r = rmin + (rmax-rmin) * Math.sqrt(i/n) ;
      var a = j * Math.PI*2/n;
      return new THREE.Vector2( 0.5 + r*Math.cos(a) , 0.5 + r*Math.sin(a) );
    }
    function uvCircularMap(i,j,n){
      // Funcion de mapeo de de coordenadas uvs,
      // dado el vertice i,j indica que coordenada de textura le corresponde
      var r = rmin + (rmax-rmin) * Math.sin(i/n*Math.PI/2) ;
      var a = j * Math.PI*2/n;
      return new THREE.Vector2( 0.5 + r*Math.cos(a) , 0.5 + r*Math.sin(a) );
    }
    function uvSphericMap(i,j,n){
      // Funcion de mapeo de de coordenadas uvs,
      // dado el vertice i,j indica que coordenada de textura le corresponde
      var alfa0 = Math.asin( rmin/0.5 ); // angulo de partida sobre la esfera
      var alfa1 = Math.acos( rmax/0.5 ); // angulo restante al final
      var alfa = ( Math.PI/2 - (alfa0+alfa1) ) / n;
      var r = 0.5 * Math.sin( i*alfa + alfa0 );
      var a = j * Math.PI*2/n;
      return new THREE.Vector2( 0.5 + r*Math.cos(a) , 0.5 + r*Math.sin(a) );
    }
	
};