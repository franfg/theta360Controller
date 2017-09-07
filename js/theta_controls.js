var cameraStream = null;
var cameraURL = null;
var cameraID=null;
var controllerSelected=0;

var projectionStarted=false;
var controllers =[];//contiene las instancias a los controladores de cada pantalla
var controllerMaps=[];//contiene los id del tipo de mapeado de cada pantalla

//Aqui se instancia un controlador por cada div con pantalla que tengamos, cuyo id debe comenzar con 'container'
var allElements = document.getElementsByTagName("*");
var angulo=0;
for(i = 0; i < allElements.length; i++){
	if(allElements[i].id.substring(0,9) == 'container'){
		angulo=allElements[i].id.substring(9);
		controllers.push(new _camera_controller(allElements[i].id,angulo));
		controllerMaps.push(0);
	}
}

// >>>>>>>>>>>- Configuracion de controles

//Permitimos seleccionar cada pantalla haciendo click en ella!
for (var i = 0; i < controllers.length; i++) {
	var divName="#"+controllers[i].getMyDiv();
	$( divName ).click(function() {
		for (var j = 0; j < controllers.length; j++) {
			if(controllers[j].getMyDiv()==$(this).attr('id')){
				changePantalla(j);
			}
		}
	});
}

//Slider de zoom
var handle = $( "#custom-handle" );
$( "#slider" ).slider({
	value:40,
	min: 3,
	max: 76,
	create: function() {
		handle.text( $( this ).slider( "value" ) );
	},
	slide: function( event, ui ) {
		handle.text( ui.value );
		controllers[controllerSelected].setCustomZoom(ui.value);//79-3=76, 79-76=3
	}
});

//CheckBox de esconder controles
$('#checkbox-1').change(function() {
	if($(this).is(':checked')){
		$( "#controlesVid" ).hide('puff');
		$('#cb1lbl').text( "Mostrar controles" );
	}else{
		$( "#controlesVid" ).show('puff');
		$('#cb1lbl').text( "Esconder controles" );
	}
});
$( "input" ).checkboxradio({
	icon: false
});

//ComboBox de seleccion de salida de camara
$( "#selectSalida" ).selectmenu();
$( "#selectSalida" ).on( "selectmenuchange", function( event, ui ) {
	if(ui.item.index>0){
		$("#firstSM1").attr("disabled", true);// Para que no se pueda seleccionar de nuevo el elemento 0
		$("#selectSalida").selectmenu("refresh");
		
		console.log("Device selected: "+ui.item.label);
		cameraID=ui.item.value;
		setCamera();
		if(!projectionStarted){
			projectionStarted=true;
			$( "#controlesVid" ).show('puff');
			$( "#hideB" ).show();
		}
		var mapIndex=1;
		switch(ui.item.label.substring(0,5)){// seleccionar automaticamente el modo de mapeo adecuado a cada salida
			case "THETA":// UVC Blender, equirectangular
				mapIndex=1;
				break;
			case "RICOH":// RAW, ojo de pez
				mapIndex=2;
				break;
		}
		changePantalla(0);
		$("#firstSM2").attr("disabled", true);// Para que no se pueda seleccionar de nuevo el elemento 0
		$("#selectController").selectmenu("refresh");
		$("#firstSM3").attr("disabled", true);// Para que no se pueda seleccionar de nuevo el elemento 0
		// seleccionar automaticamente el modo de mapeo adecuado a cada salida
		$('#selectMapping').prop("selectedIndex",mapIndex).selectmenu('refresh');
		for (var i = 0; i < controllers.length; i++) {
			controllers[i].updateVideoScreen(mapIndex);
			controllerMaps[i]=mapIndex;
		};
	}
} );

//ComboBox de seleccion de pantalla a configurar
$( "#selectController" ).selectmenu();
var selectC = document.getElementById("selectController"); 
for (var i = 0; i < controllers.length; i++) {//anadir al combobox el numero de elementos correspondiente (numero de controladores[divs])
	var el = document.createElement("option");
	el.textContent = "Pantalla "+(i+1);
	el.value = i;
	selectC.appendChild(el);
}
$( "#selectController" ).on( "selectmenuchange", function( event, ui ) {
	if(ui.item.index>0){
		changePantalla(ui.item.index-1);
	}
} );

//ComboBox de seleccion de mapeo del pantalla seleccionado
$( "#selectMapping" ).selectmenu();
$( "#selectMapping" ).on( "selectmenuchange", function( event, ui ) {
	if(ui.item.index>0){
		$("#firstSM3").attr("disabled", true);// Para que no se pueda seleccionar de nuevo el elemento 0
		$("#selectMapping").selectmenu("refresh");
		
		controllers[controllerSelected].updateVideoScreen(ui.item.index);
		controllerMaps[controllerSelected]=ui.item.index;
		if(ui.item.index==3){//Modificar el slider del zoom a su valor por defecto en cada modo de mapeo
			$("#slider").slider('value',3);
			handle.text( $("#slider").slider( "value" ) );
			$("#slider").slider('disable');
		}else{
			$("#slider").slider('enable');
			$("#slider").slider('value',40);
			handle.text( $("#slider").slider( "value" ) );
		}
	}
} );
$( "#controlesVid" ).hide();// Esconder los controles de la camara hasta que se seleccione una
$( "#hideB" ).hide();

//Funciones auxiliares para los controles
function changePantalla(idPantalla){
	controllerSelected=idPantalla;
	$('#selectController').prop("selectedIndex",controllerSelected+1).selectmenu('refresh');//seleccionar la pantalla correcta en el combobox
	$('#selectMapping').prop("selectedIndex",controllerMaps[controllerSelected]).selectmenu('refresh');//seleccionar el mapeado de esa pantalla en su combobox
	var zoomL=controllers[controllerSelected].getCustomZoom();//colocar el slider del zoom al de la pantalla seleccionada
	$("#slider").slider('value',zoomL);
	handle.text( $("#slider").slider( "value" ) );
	if(controllerMaps[controllerSelected]==3){//si el mapeo es en plano
		$("#slider").slider('disable');//desabilitar zoom
	}else{
		$("#slider").slider('enable');
	}
	//Cambiar las clases de las pantallas
	for (var i = 0; i < controllers.length; i++) {
		var divdName="#"+controllers[i].getMyDiv();
		$(divdName).attr('class', 'contenedor');
	}
	//var divName="#container"+(controllerSelected+1);
	var divName="#"+controllers[controllerSelected].getMyDiv();
	$(divName).attr('class', 'contenedorS');
}

// Acceso a dispositivos(camara)   ---   https://developer.mozilla.org/es/docs/Web/API/Navigator/getUserMedia -->
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

if(navigator.getUserMedia){// Nos aseguramos de que el navegador soporta WebRTC
	// Obtener las camaras del sistema y rellenar el combobox
	navigator.mediaDevices.enumerateDevices()
	.then(devices => {
		var videoDevices = [0,0];
		var videoDeviceIndex = 0;
		var select = document.getElementById("selectSalida"); 
		devices.forEach(function(device) {
			if (device.kind == "videoinput") {  
				console.log(device.kind + ": " + device.label + " id = " + device.deviceId);//TODO solo camaras theta
				console.log(device.label.indexOf("THETA"));
				if(device.label.indexOf("THETA")>=0){
					videoDevices[videoDeviceIndex++] =  device.deviceId;
					var el = document.createElement("option");
					el.textContent = device.label;
					el.value = device.deviceId;
					select.appendChild(el);
				}
			}
		});
	}).catch(e => console.error(e));
}else{
	alert("WebRTC no soportado por su navegador");
}

//Funcion que inicializa los controladores con la camara seleccionada
function setCamera(){
	navigator.mediaDevices.enumerateDevices()
	.then(devices => {
		var constraints =  {deviceId: { exact: cameraID } };
		if (cameraStream) {// Si ya se esta visualizando una camara hay que detenerla, ya que el navegador solo puede acceder a una camara al mismo tiempo
			cameraStream.getTracks().forEach(function(track) {
			  track.stop();
			});
		}
		return navigator.mediaDevices.getUserMedia({ video: constraints });
	})
	.then(stream => {
		cameraStream = stream;
		cameraURL = window.URL.createObjectURL(cameraStream);
		console.log(cameraStream);
		// Enviar el stream de video a cada pantalla
		for (var i = 0; i < controllers.length; i++) {
			controllers[i].setVideoSrc(cameraURL);
		};
	})
	.catch(e => console.error(e));
}
			