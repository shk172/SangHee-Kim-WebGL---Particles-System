//SangHee Kim
//shk172
//EECS 395 - Intermediate Graphics
//Project A
//Particle System

//==============================================================================
// Vertex shader program:
var PARTICLE_VSHADER_SOURCE =
  'precision highp float;\n' +				// req'd in OpenGL ES if we use 'float'
  //
  'attribute vec4 a_Position; \n' +				// current state: particle position
  'attribute vec3 a_Color; \n' +					// current state: particle color
  'attribute float a_diam; \n' +					// current state: diameter in pixels

  'attribute vec4 o_Position; \n' +		//Position of the non-particle objects
  'attribute vec3 o_Color; \n' +		//Color of the non-particle objects
  
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjMatrix;\n' +

  'varying   vec4 v_Color; \n' +					// (varying--send to particle
  'void main() {\n' +
  '	 gl_Position = u_ProjMatrix* u_ViewMatrix * (vec4(a_Position.x -0.9, a_Position.y -0.9, a_Position.z, 1.0) + o_Position);  \n' +	
  '  gl_PointSize = a_diam; \n' +
  '  v_Color = vec4(a_Color, 1.0) + vec4(o_Color, 1.0); \n' +
  '} \n';
// Each instance computes all the on-screen attributes for just one VERTEX,
// supplied by 'attribute vec4' variable a_Position, filled from the 
// Vertex Buffer Object (VBO) we created inside the graphics hardware by calling 
// the 'initVertexBuffers()' function, and updated by 'PartSys_render() calls.

//==============================================================================
// Fragment shader program:
var PARTICLE_FSHADER_SOURCE =
  'precision mediump float;\n' +
  'uniform  int u_runMode; \n' +
  'uniform vec4 u_eyePosWorld; \n' + 	
  'varying vec4 v_Color; \n' +

  'void main() {\n' +  
  '  if(u_runMode == 0) { \n' +
	'	   gl_FragColor = v_Color;	\n' +		// red: 0==reset
	'  } \n' +
	'  else if(u_runMode == 1 || u_runMode == 2) {  \n' + //  1==pause, 2==step
	'    float dist = distance(gl_PointCoord, vec2(0.5,0.5)); \n' +
	'    if(dist < 0.5) { gl_FragColor = v_Color; } else {discard; } \n' +
	'  }  \n' +
	'  else { \n' +
  '    float dist = distance(gl_PointCoord, vec2(0.5, 0.5)); \n' +
  '    if(dist < 0.5) { \n' +	
	'  	    gl_FragColor = vec4((1.0 - 1.5*dist)*v_Color.rgb, 1.0);\n' +
	'    } else { discard; }\n' +
  '  }  \n;' +
  '} \n';


//==============================================================================
// Vertex shader program:
var OBJECT_VSHADER_SOURCE =
  'precision highp float;\n' +				// req'd in OpenGL ES if we use 'float'

  'attribute vec4 o_Position; \n' +		//Position of the non-particle objects
  'attribute vec3 o_Color; \n' +		//Color of the non-particle objects
  
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjMatrix;\n' +

  'varying   vec4 v_Color; \n' +					// (varying--send to particle
  'void main() {\n' +
  '	 gl_Position = u_ProjMatrix* u_ViewMatrix * o_Position;  \n' +	
  '  v_Color = vec4(o_Color, 1.0); \n' +
  '} \n';

//==============================================================================
// Object Fragment shader program:
var OBJECT_FSHADER_SOURCE =
  'precision mediump float;\n' +
  'uniform vec4 u_eyePosWorld; \n' + 	
  'varying vec4 v_Color; \n' +

  'void main() {\n' +  
  	'gl_FragColor = v_Color; \n' +
  '} \n';




// Global Variables
// =========================
var timeStep = 1.0/30.0;				// initialize; current timestep in seconds
var g_last = Date.now();				// Timestamp: set after each frame of animation,
																// used by 'animate()' function to find how much
																// time passed since we last updated our canvas.
var	eyePosWorld = new Float32Array(3);	// x,y,z in world coords


//PARTICLE VARIABLES////////////////////////////////////////////////////////////////
// Give meaningful names to array indices for the particle(s) in state vectors.
const PART_XPOS     = 0;  //  position    
const PART_YPOS     = 1;
const PART_ZPOS     = 2;
const PART_XVEL     = 3; //  velocity    
const PART_YVEL     = 4;
const PART_ZVEL     = 5;
const PART_X_FTOT   = 6;  // force accumulator:'ApplyForces()' fcn clears
const PART_Y_FTOT   = 7;  // to zero, then adds each force to each particle.
const PART_Z_FTOT   = 8;        
const PART_R        = 9;  // color : red,green,blue
const PART_G        =10;  
const PART_B        =11;
const PART_MASS     =12;  // mass   
const PART_DIAM 		=13;	// on-screen diameter (in pixels)
const PART_RENDMODE =14;	// on-screen appearance (square, round, or soft-round)
/* // Other useful particle values, currently unused
const PART_AGE      =15;  // # of frame-times since creation/initialization
const PART_CHARGE   =16;  // for electrostatic repulsion/attraction
const PART_MASS_VEL =17;  // time-rate-of-change of mass.
const PART_MASS_FTOT=18;  // force-accumulator for mass-change
const PART_R_VEL    =19;  // time-rate-of-change of color:red
const PART_G_VEL    =20;  // time-rate-of-change of color:grn
const PART_B_VEL    =21;  // time-rate-of-change of color:blu
const PART_R_FTOT   =22;  // force-accumulator for color-change: red
const PART_G_FTOT   =23;  // force-accumulator for color-change: grn
const PART_B_FTOT   =24;  // force-accumulator for color-change: blu
*/
const PART_MAXVAR   =15;  // Size of array in CPart uses to store its values.
var partCount = 500;				// # of particles in our state variable s[0] that
//TRY 321,123 particles...)		// we will actually display on-screen.				
var myRunMode = 0;			// Particle System: 0=reset; 1= pause; 2=step; 3=run
var INIT_VEL = 0.20;		// avg particle speed: ++Start,--Start buttons adjust.
// Create & initialize our first, simplest 'state variable' s0:
// Note that I've made 3 particles here, but at first I'll just use one of them.


//Particle states////////////////////////////////////////////////////////////////
var s0 = new Float32Array(partCount * PART_MAXVAR);
var s1 = new Float32Array(partCount * PART_MAXVAR);
var sDot = new Float32Array(partCount * PART_MAXVAR);
var FSIZE = s0.BYTES_PER_ELEMENT;


//FORCERS////////////////////////////////////////////////////////////////////////
const F_NONE		= 0;  // No force applied   
const F_GRAV_E		= 1;  // Earth's gravity
const F_GRAV_P		= 2;  // Planetary gravity
const F_SPRING		= 3;  // Spring force      
const F_MAX			= 4;  // Total number of types of force-making objects

//	Earth Gravity = -mG in negative Z
var gravity = true; //gravity is turned on by default
//	Planetary Gravity = (m1*m2)/dist(p1,p2)^2
//	Friction
//		Surface
//		Air/Fluid/Viscosity
//	Magnetism
//	Electrostatic/Charge
//	Springs
//	Fluid forces
var forcerCount = 3;
var f0 = new Float32Array(F_MAX); // Array holding the force-inducing objcets

//CONSTRAINTS///////////////////////////////////////////////////////////////////
const C_WALL_XMIN		= 1; 
const C_WALL_XMAX		= 2;
const C_WALL_YMIN		= 3;
const C_WALL_YMAX		= 4;
const C_WALL_ZMIN		= 5;
const C_WALL_ZMAX		= 6;
const C_WALL_A_NX 		= 7;
const C_WALL_A_NY 		= 8;
const C_WALL_A_NZ 		= 9;
const C_WALL_A_BOUNCE_LOSS = 10;
const C_ATT_MAX			= 11; // number of attributes of constraining objects
/////////////
const C_NONE = true;
const C_WALL_A = false;
const C_WALL_E = false;
const C_MAX = 2;
var c0 = new Float32Array(C_MAX); // Array holding the constraints
																
// For keyboard, mouse-click-and-drag:----------------------------------------		
var isDrag=false;		// mouse-drag: true when user holds down mouse button
var xMclik=0.0;			// last mouse button-down position (in CVV coords)
var yMclik=0.0;   
var xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;  

function main() {
//==============================================================================
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
	// Register the Mouse & Keyboard Event-handlers-------------------------------
	// If users move, click or drag the mouse, or they press any keys on the 
  canvas.onmousedown	=	function(ev){myMouseDown( ev, gl, canvas) }; 
  canvas.onmousemove = 	function(ev){myMouseMove( ev, gl, canvas) };				
  canvas.onmouseup = 		function(ev){myMouseUp(   ev, gl, canvas)};
  					
  // Next, register all keyboard events found within our HTML webpage window:
	window.addEventListener("keypress", myKeyPress, false);	

	
  // Initialize shaders
  var particleShaders = createProgram(gl,PARTICLE_VSHADER_SOURCE, PARTICLE_FSHADER_SOURCE);
  var objectShaders = createProgram(gl, OBJECT_VSHADER_SOURCE, OBJECT_FSHADER_SOURCE);
  if (!particleShaders||!objectShaders) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Get storage locations of attribute and uniform variables in program object for single color drawing
  objectShaders.o_Position = gl.getAttribLocation(objectShaders, 'o_Position');
  objectShaders.o_Color = gl.getAttribLocation(objectShaders, 'o_Color');
  objectShaders.u_ViewMatrix = gl.getUniformLocation(objectShaders, 'u_ViewMatrix');
  objectShaders.u_ProjMatrix = gl.getUniformLocation(objectShaders, 'u_ProjMatrix');  
  console.log(objectShaders.o_Position);
  console.log(!objectShaders.o_Color);
  if(objectShaders.o_Position < 0|| !objectShaders.o_Color) {
  	console.log('Failed to get location for an object shader attribute');
  	return;
  }	
	
  // Get storage locations of attribute and uniform variables in program object for texture drawing
  particleShaders.a_Position = gl.getAttribLocation(particleShaders, 'a_Position');
  particleShaders.a_Color = gl.getAttribLocation(particleShaders, 'a_Color');
  particleShaders.a_diam = gl.getAttribLocation(particleShaders, 'a_diam');
  particleShaders.u_runModeID = gl.getAttribLocation(particleShaders, 'u_runMode');
  particleShaders.u_ViewMatrix = gl.getUniformLocation(particleShaders, 'u_ViewMatrix');
  particleShaders.u_ProjMatrix = gl.getUniformLocation(particleShaders, 'u_ProjMatrix');

  if(particleShaders.a_Position < 0|| !particleShaders.a_Color||
  	!particleShaders.a_diam||!particleShaders.u_runModeID) {
  	console.log('Failed to get location for a particle shader attribute');
  	return;
  }	
	gl.uniform1i(particleShaders.u_runModeID, myRunMode);		// (keyboard callbacks set myRunMode)
	// initialize the particle system:
	PartSys_init(0);			// 0 == full reset, bouncy-balls; 1==add velocity
												// 2 == set up spring-mass system; ...
	
  // create the Vertex Buffer Object in the graphics hardware, fill it with
  // contents of state variable
  var myVerts = initVertexBuffers(gl, particleShaders.a_Position, objectShaders.a_Color, objectShaders.a_diam);
  if (myVerts < 0) {
    console.log('Failed to create the Vertex Buffer Object');
    return;
  }

  // Create the Vertex Buffer Object for the non-particle objects
	var objectVerts = initObjectVertexBuffers(gl, objectShaders.o_Position, objectShaders.o_Color);
	if (objectVerts < 0){
  		console.log('Failed to create the Vertex Buffer Object');
		return;
	} 

	gl.clearColor(0.0, 0.0, 0.0, 1);	  // RGBA color for clearing <canvas>

	var viewMatrix = new Matrix4();　// The view matrix
	var projMatrix = new Matrix4();  // The projection matrix

	viewMatrix.setLookAt(eyePosWorld[0], eyePosWorld[1], eyePosWorld[2], 
  							see_X, see_Y, see_Z, 								// look-at point (origin)
  										0, 0, 1);	
  	projMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);

  	// Pass the view and projection matrix to u_ViewMatrix, u_ProjMatrix of each shaders
  	gl.uniformMatrix4fv(objectShaders.u_ViewMatrix, false, viewMatrix.elements);
  	gl.uniformMatrix4fv(objectShaders.u_ProjMatrix, false, projMatrix.elements);
  	gl.uniformMatrix4fv(particleShaders.u_ViewMatrix, false, viewMatrix.elements);
  	gl.uniformMatrix4fv(particleShaders.u_ProjMatrix, false, projMatrix.elements);



	eyePosWorld.set([4.0, 4.0, 4.0]);


  var tick = function() {
    timeStep = animate(timeStep);  // get time passed since last screen redraw. 
  	drawParticles(gl, myVerts, timeStep, particleShaders, viewMatrix, projMatrix);	// compute new particle state at current time
    drawObjects(gl, objectVerts, objectShaders, viewMatrix, projMatrix);
    requestAnimationFrame(tick, canvas);  // Call again 'at next opportunity',
  }; 																			// within the 'canvas' HTML-5 element.
  tick();
}


function initObjectVertexBuffers(gl, o_Position, o_Color){
	vertexObjectID = gl.createBuffer();
	if (!vertexObjectID) {
	    console.log('Failed to create the gfx buffer object');
		return -1;
	}
	//Create vertices for the non-particle objects
	makeGroundGrid();
	makeBox();
	makeSphere();

	//Assign vertices to the buffer object
	var vertexLength = gndVerts.length + boxVerts.length + sphVerts.length; 
	var vertices = new Float32Array(vertexLength);
	gndStart = 0;						// next we'll store the ground-plane;
		for(i = 0, j = 0; j<gndVerts.length; i++, j++) {
		vertices[i] = gndVerts[j];
		}

	boxStart = i;						// next we'll store the ground-plane;
		for(j=0; j<boxVerts.length; i++, j++) {
		vertices[i] = boxVerts[j];
		}
	sphStart = i;
		for(j=0; j<sphVerts.length; i++, j++) {
		vertices[i] = sphVerts[j];
		}

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexObjectID);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	//Assign the buffer objects to the attribute variables///////////
  gl.vertexAttribPointer(o_Position, 4, gl.FLOAT, false, 6 *vertices.BYTES_PER_ELEMENT, 0);

  // ---------------Connect 'o_Color' attribute to bound buffer:--------------
  gl.vertexAttribPointer(o_Color,	3, gl.FLOAT, false,	6 * vertices.BYTES_PER_ELEMENT, 4 * vertices.BYTES_PER_ELEMENT);

  //Enable the attribute assignments
   gl.enableVertexAttribArray(o_Position);
   gl.enableVertexAttribArray(o_Color);

  return vertexLength/6;
}


function initVertexBuffers(gl, a_Position, a_Color, a_diam) {
//==============================================================================
// Set up all buffer objects on our graphics hardware.
//
// Create a buffer object in the graphics hardware: get its ID# 
	vertexBufferID = gl.createBuffer();				//(make it global: PartSys_render()
  													// modifies this buffers' contents)
	if (!vertexBufferID) {
	    console.log('Failed to create the gfx buffer object');
		return -1;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferID);
	gl.bufferData(gl.ARRAY_BUFFER, s0, gl.DYNAMIC_DRAW);
  							
	// ---------------Connect 'a_Position' attribute to bound buffer:-------------
  // Get the ID# for the a_Position variable in the graphics hardware
  // (keep it as global var--we'll need it for PartSys_render())
 
  gl.vertexAttribPointer(a_Position, 4, gl.FLOAT, false, PART_MAXVAR *FSIZE, PART_XPOS*FSIZE);
  // Enable this assignment of the a_Position variable to the bound buffer:
  gl.enableVertexAttribArray(a_Position);

  // ---------------Connect 'a_Color' attribute to bound buffer:--------------
  // Tell GLSL to fill 'a_Color' attribute variable for each shader 
  // with values in the buffer object chosen by 'gl.bindBuffer()' command.
  gl.vertexAttribPointer(a_Color,	3, gl.FLOAT, false,	PART_MAXVAR * FSIZE, PART_R * FSIZE);
  gl.enableVertexAttribArray(a_Color);

  // ---------------Connect 'a_diam' attribute to bound buffer:---------------
  // Tell GLSL to fill 'a_Position' attribute variable for each shader 
  // with values in the buffer object chosen by 'gl.bindBuffer()' command.
  gl.vertexAttribPointer(a_diam,	1, gl.FLOAT, false,	PART_MAXVAR*FSIZE, PART_DIAM*FSIZE); 
  // Enable this assignment of the a_Position variable to the bound buffer:
  gl.enableVertexAttribArray(a_diam);

	// --------------DONE with connecting attributes to bound buffer:-----------
  return partCount;
}




function animate(timeStep) {
//============================================================================== 
// How much time passed since we last updated the 'canvas' screen elements?
  var now = Date.now();												
  var elapsed = now - g_last;								
  g_last = now;  
  return elapsed;					// Return the amount of time passed.
}

function drawParticles(gl, myVerts, timeStep, particleShaders, projMatrix) {
//============================================================================== 
  gl.clear(gl.COLOR_BUFFER_BIT);  					// Clear <canvas>
  gl.useProgram(particleShaders); //Tell this program object is used
  
  if(myRunMode>1) {									// 0=reset; 1= pause; 2=step; 3=run default state
		if(myRunMode==2) myRunMode=1;				// (if 2, do just one step and pause.)
		timeStep = timeStep/20;
		applyForces(s0);
		dotFinder(s0, sDot);
		//PartSys_render(gl, s0);  				// Draw the particle-system on-screen:	
		solver(s0,sDot,s1, timeStep);
		doConstraints(s1);
		for(var i=0; i<partCount; i++) {			// for every particle in s0 state:
			var pOff = i * PART_MAXVAR;				// offset to start of i-th particle
			//Swap States/////////////////////////////////////////////////////
			s0[PART_XPOS+ pOff] = s1[PART_XPOS+ pOff];
			s0[PART_YPOS+ pOff] = s1[PART_YPOS+ pOff];
			s0[PART_ZPOS+ pOff] = s1[PART_ZPOS+ pOff];
			s0[PART_XVEL+ pOff] = s1[PART_XVEL+ pOff];
			s0[PART_YVEL+ pOff] = s1[PART_YVEL+ pOff];
			s0[PART_ZVEL+ pOff] = s1[PART_ZVEL+ pOff];
		}
	}
	gl.drawArrays(gl.LINES, 0, gndVerts.length/6);	
	gl.drawArrays(gl.LINES, gndVerts.length/6, boxVerts.length/6);	
	//gl.drawArrays(gl.LINES, gndVerts.length/6 + boxVerts.length/6, sphVerts.length/6);	
  	// Set the matrix to be used for to set the camera view
	viewMatrix.setLookAt(eyePosWorld[0], eyePosWorld[1], eyePosWorld[2], 
  							see_X, see_Y, see_Z, 								// look-at point (origin)
  								0, 0, 1);								// up vector (+z)
  // Pass the view projection matrix
	gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);
	gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
	gl.uniform1i(u_runModeID, myRunMode);	//run/step/pause changes particle shape

  // Report mouse-drag totals.
	document.getElementById('MouseResult0').innerHTML=
			'Mouse Drag totals (CVV coords):\t'+xMdragTot+', \t'+yMdragTot;	
}

function doConstraints(s1){
	for(i = 0; i < partCount; i++){
		var pOff = i * PART_MAXVAR;				// offset to start of i-th particle
		//===================================================================
		// APPLY CONSTRAINTS to the 'next' state of our particle system:
		//===================================================================		
		if(s1[PART_XPOS+ pOff] < 0.0 && s1[PART_XVEL+ pOff] < 0.0) {			
			 s1[PART_XVEL+ pOff] = -s1[PART_XVEL+ pOff];
		}
		else if (s1[PART_XPOS+ pOff] > 1.8 && s1[PART_XVEL+ pOff] > 0.0) {		
			s1[PART_XVEL+ pOff] = -s1[PART_XVEL+ pOff];
		}

		if(s1[PART_YPOS+ pOff] < 0.0 && s1[PART_YVEL+ pOff] < 0.0) {		
			 s1[PART_YVEL+ pOff] = -s1[PART_YVEL+ pOff];
		}
		else if( s1[PART_YPOS+ pOff] > 1.8 && s1[PART_YVEL+ pOff] > 0.0) {		
			s1[PART_YVEL+ pOff] = -s1[PART_YVEL+ pOff];
		}

		if(s1[PART_ZPOS+ pOff] < 0.0 && s1[PART_ZVEL+ pOff] < 0.0) {			//if the particle is underneath the floor
			 s1[PART_ZVEL+ pOff] = -s0[PART_ZVEL+ pOff];						//Reverse the current velocity, assuming 
		}																		//that s1's velocity is always below the ground
		else if( s1[PART_ZPOS+ pOff] > 1.8 && s1[PART_ZVEL+ pOff] > 0.0) {		//if the particle is above the ceiling
			s1[PART_ZVEL+ pOff] = -s1[PART_ZVEL+ pOff];							//reverse the velocity
		}			

		//  -- hard limit on 'floor' keeps y position >= 0;
		if(s1[PART_XPOS+ pOff] <  -0.0) s1[PART_XPOS+ pOff] = 0.0;			
		if(s1[PART_XPOS+ pOff] >=  1.8) s1[PART_XPOS+ pOff] = 1.8;
		if(s1[PART_YPOS+ pOff] <  -0.0) s1[PART_YPOS+ pOff] = 0.0;
		if(s1[PART_YPOS+ pOff] >=  1.8) s1[PART_YPOS+ pOff] = 1.8;
		if(s1[PART_ZPOS+ pOff] <  -0.0) s1[PART_ZPOS+ pOff] = 0.0;			
		if(s1[PART_ZPOS+ pOff] >=  1.8) s1[PART_ZPOS+ pOff] = 1.8;
		//============================================
	}
}

function solver(s0, sDot, s1, timeStep){
	for(i = 0; i < partCount; i++){
		var pOff = i * PART_MAXVAR;				// offset to start of i-th particle
		s1[PART_XVEL+ pOff] = (s0[PART_XVEL+ pOff] + (timeStep* sDot[PART_XVEL+ pOff])) * 0.985;
		s1[PART_YVEL+ pOff] = (s0[PART_YVEL+ pOff] + (timeStep* sDot[PART_YVEL+ pOff])) * 0.985;
		s1[PART_ZVEL+ pOff] = (s0[PART_ZVEL+ pOff] + (timeStep* sDot[PART_ZVEL+ pOff])) * 0.985;

		//New Position = currentPos + h*(currentVel + 0.5*h*acc)
		s1[PART_XPOS+ pOff] = s0[PART_XPOS+ pOff] + timeStep* (s0[PART_XVEL+ pOff] + (0.5* timeStep* sDot[PART_XVEL+ pOff]));
		s1[PART_YPOS+ pOff] = s0[PART_YPOS+ pOff] + timeStep* (s0[PART_YVEL+ pOff] + (0.5* timeStep* sDot[PART_YVEL+ pOff])); 
		s1[PART_ZPOS+ pOff] = s0[PART_ZPOS+ pOff] + timeStep* (s0[PART_ZVEL+ pOff] + (0.5* timeStep* sDot[PART_ZVEL+ pOff]));
	}
}

function dotFinder(s, sDot){
	for(i = 0; i < partCount; i++){
		var pOff = i * PART_MAXVAR;				// offset to start of i-th particle
		sDot[PART_XPOS+ pOff] = s[PART_XVEL + pOff];							//Velocity on X
		sDot[PART_YPOS+ pOff] = s[PART_YVEL + pOff]; 							//Velocity on Y
		sDot[PART_ZPOS+ pOff] = s[PART_ZVEL + pOff]; 							//Velocity on Z
		sDot[PART_XVEL+ pOff] = s[PART_X_FTOT + pOff] / s0[PART_MASS + pOff];	//Acceleration on X
		sDot[PART_YVEL+ pOff] = s[PART_Y_FTOT + pOff] / s0[PART_MASS + pOff];	//Acceleration on Y
		sDot[PART_ZVEL+ pOff] = s[PART_Z_FTOT + pOff] / s0[PART_MASS + pOff];	//Acceleration on Z
	}
}
function applyForces(s){
	for(i = 0; i < partCount; i++){
		var pOff = i * PART_MAXVAR;
		var xForce = 0.0;
		var yForce = 0.0;
		var zForce = 0.0;
		if(gravity == true){
			zForce = s[PART_MASS] * -0.01
		}
		// if(spring == true && i > 0){
		// 	s[PART_XPOS + ]
		// }
		s[PART_Z_FTOT+pOff] = zForce;
	}
}

function PartSys_render(gl, s) {
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, s);
	gl.drawArrays(gl.POINTS, 0, partCount);
}

function PartSys_init(sel) {
//==============================================================================
// set initial values of all particle-system state.
// sel==0 for 3 bouncy-ball particles, == 1 to add velocity to all particles.

var doit=1;
	switch(sel) {
    case 0:
			for(var i=0; i<partCount; i++) {
				var pOff = i*PART_MAXVAR;			// starting index of each particle
				var xcyc = roundRand3D();
				s0[pOff + PART_XPOS] = 0.2 + 0.2*xcyc[0];		// 0.0 <= randomRound() < 1.0
				s0[pOff + PART_YPOS] = 0.2 + 0.2*xcyc[1];
				s0[pOff + PART_ZPOS] = 0.2 + 0.2*xcyc[2];
				xcyc = roundRand3D();				//Create new random three numbers to be added to the velocity
				s0[pOff + PART_XVEL] = INIT_VEL*(0.4 + 0.2*xcyc[0]);
				s0[pOff + PART_YVEL] = INIT_VEL*(0.4 + 0.2*xcyc[1]);
				s0[pOff + PART_ZVEL] = INIT_VEL*(0.4 + 0.2*xcyc[2]);
				s0[pOff + PART_X_FTOT] = 0.0;
				s0[pOff + PART_Y_FTOT] = 0.0;
				s0[pOff + PART_Z_FTOT] = 0.0;
				s0[pOff + PART_R] = 0.2 + 0.8*Math.random();
				s0[pOff + PART_G] = 0.2 + 0.8*Math.random();
				s0[pOff + PART_B] = 0.2 + 0.8*Math.random();
				s0[pOff + PART_MASS] = 2.0 + 0.2*Math.random();
				s0[pOff + PART_DIAM] = 1.0 + 10.0*Math.random();
				s0[pOff + PART_RENDMODE] = Math.floor(4.0*Math.random()); // 0,1,2 or 3.
			}

       break;
    case 1:					// increase current velocity by INIT_VEL
    default:
			
    	break;
    case 2:
    	for(var i=0; i<partCount; i++) {
				var pOff = i*PART_MAXVAR;			// starting index of each particle
				var xcyc = roundRand3D();
				s0[pOff + PART_XPOS] = 0.2 + 0.2*xcyc[0];		// 0.0 <= randomRound() < 1.0
				s0[pOff + PART_YPOS] = 0.2 + 0.2*xcyc[1];
				s0[pOff + PART_ZPOS] = 0.2 + 0.2*xcyc[2];
				xcyc = roundRand3D();				//Create new random three numbers to be added to the velocity
				s0[pOff + PART_XVEL] = INIT_VEL*(0.4 + 0.2*xcyc[0]);
				s0[pOff + PART_YVEL] = INIT_VEL*(0.4 + 0.2*xcyc[1]);
				s0[pOff + PART_ZVEL] = INIT_VEL*(0.4 + 0.2*xcyc[2]);
				s0[pOff + PART_X_FTOT] = 0.0;
				s0[pOff + PART_Y_FTOT] = 0.0;
				s0[pOff + PART_Z_FTOT] = 0.0;
				s0[pOff + PART_R] = 0.2 + 0.8*Math.random();
				s0[pOff + PART_G] = 0.2 + 0.8*Math.random();
				s0[pOff + PART_B] = 0.2 + 0.8*Math.random();
				s0[pOff + PART_MASS] = 0.9 + 0.2*Math.random();
				s0[pOff + PART_DIAM] = 1.0 + 10.0*Math.random();
				s0[pOff + PART_RENDMODE] = Math.floor(4.0*Math.random()); // 0,1,2 or 3.
			}
    	break;
   }
}

function roundRand3D() {
//==============================================================================
// On each call, find a different 3D point (xball, yball, zball) chosen 
// 'randomly' and 'uniformly' inside a sphere of radius 1.0 centered at origin.  
// More formally: 
//  	--xball*xball + yball*yball + zball*zball < 1.0, and 
//		--uniform probability density function inside this radius=1 circle.
//		(within this sphere, all regions of equal volume are equally likely to
//		contain the the point (xball,yball,zball)).
	do {			// 0.0 <= Math.random() < 1.0 with uniform PDF.
		xball = 2.0*Math.random() -1.0;			// choose an equally-likely 2D point
		yball = 2.0*Math.random() -1.0;			// within the +/-1, +/-1 square.
		zball = 2.0*Math.random() -1.0;
		}
	while(xball*xball + yball*yball + zball*zball >= 1.0);		// keep 1st point inside sphere.
	ret = new Array(xball,yball,zball);
	return ret;
}


//===================Mouse and Keyboard event-handling Callbacks================
//==============================================================================
function myMouseDown(ev, gl, canvas) {
//==============================================================================
// Called when user PRESSES down any mouse button;
// 									(Which button?    console.log('ev.button='+ev.button);   )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									//x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top);	//y==0 at canvas bottom edge
//  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
//	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = true;											// set our mouse-dragging flag
	xMclik = x;													// record where mouse-dragging began
	yMclik = y;
		document.getElementById('MouseResult1').innerHTML = 
	'myMouseDown() at CVV coords x,y = '+x+', '+y+'<br>';
};

function myMouseMove(ev,gl,canvas) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	if(isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									//x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	//y==0 at canvas bottom edge
//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
//	console.log('myMouseMove(CVV coords  ):  x, y=\t',x,',\t',y);

	// find how far we dragged the mouse:
	xMdragTot += (x - xMclik);					// Accumulate change-in-mouse-position,&
	yMdragTot += (y - yMclik);
	xMclik = x;													// Make next drag-measurement from here.
	yMclik = y;
// (? why no 'document.getElementById() call here, as we did for myMouseDown()
// and myMouseUp()? Because the webpage doesn't get updated when we move the 
// mouse. Put the web-page updating command in the 'draw()' function instead)
};

function myMouseUp(ev,gl,canvas) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  
// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;								// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);// y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);
	// Put it on our webpage too...
	document.getElementById('MouseResult1').innerHTML = 
	'myMouseUp(       ) at CVV coords x,y = '+x+', '+y+'<br>';
};

//Global variables for camera movements
var angle = 0;
var see_X = 0, see_Y = 0, see_Z = 0.5;
var dir = 0;
var intensity = 0.1;


var left_F = -3.0;
var bottom_F = -3.0;
var right_F = 3.0;
var top_F = 3.0;
var near_F = 0.0;
var far_F = 2000.0;
function myKeyPress(ev) {
	myChar = String.fromCharCode(ev.keyCode);	//	convert code to character-string

	// Report EVERYTHING about this pressed key in the webpage 
	// in the <div> element with id='Result':r 
	document.getElementById('KeyResult').innerHTML = 
   			'char= ' 		 	+ myChar 			+ ', keyCode= '+ ev.keyCode 	+ 
   			', charCode= '+ ev.charCode + ', shift= '	 + ev.shiftKey 	+ 
   			', ctrl= '		+ ev.shiftKey + ', altKey= ' + ev.altKey 		+ 
   			', metaKey= '	+ ev.metaKey 	+ '<br>' ;
  			
  // update particle system state? myRunMode 0=reset; 1= pause; 2=step; 3=run
	switch(myChar) {
		case '0':	
			myRunMode = 0;			// RESET!
			break;
		case '1':
			myRunMode = 1;			// PAUSE!
			break;
		case '2':
			myRunMode = 2;			// STEP!
			break;
		case '3':							// RUN!
			myRunMode = 3;
			break;
		case 'g':
			if(gravity == true){
				gravity = false;
			}
			else if(gravity == false){
				gravity = true;
			}
			break;
		case 'R':  // HARD reset: position AND velocity.
			myRunMode = 0;			// RESET!
			PartSys_init(0);
			break;
		case 'r':		// 'SOFT' reset: boost velocity only.
			for(var i=0; i<partCount; i++) {
				var pOff = i*PART_MAXVAR;			// starting index of each particle
				if(  s0[pOff + PART_XVEL] > 0) {
					   s0[pOff + PART_XVEL] += (0.2 + 0.8*Math.random())*INIT_VEL;
					}
				else s0[pOff + PART_XVEL] -= (0.2 + 0.8*Math.random())*INIT_VEL;

				if(  s0[pOff + PART_YVEL] > 0) {
					   s0[pOff + PART_YVEL] += (0.2 + 0.8*Math.random())*INIT_VEL;
					}
				else s0[pOff + PART_YVEL] -= (0.2 + 0.8*Math.random())*INIT_VEL;

				if(  s0[pOff + PART_ZVEL] > 0) {
					   s0[pOff + PART_ZVEL] += (0.2 + 0.8*Math.random())*INIT_VEL;
					}
				else s0[pOff + PART_ZVEL] -= (0.2 + 0.8*Math.random())*INIT_VEL;
			}
			break;	
		case 'p':
		case 'P':			// toggle pause/run:
			if(myRunMode==3) myRunMode = 1;		// if running, pause
			else myRunMode = 3;		// if paused, run.
			break;
		case ' ':			// space-bar: single-step
			myRunMode = 2;
			break;
		default:
			console.log('myKeyPress(): Ignored key: '+myChar);
			break;


		case 'l': // The right arrow key was pressed
			see_X = eyePosWorld[0] + Math.cos(angle);	
			see_Y = eyePosWorld[1] + Math.sin(angle);
			angle -= 0.03;
		    break; 
		case 'j': // The left arrow key was pressed
			see_X = eyePosWorld[0] + Math.cos(angle);
			see_Y = eyePosWorld[1] + Math.sin(angle);
			angle += 0.03;
		    break;
		case 'i': // The up arrow key was pressed
			see_Z += 0.03;
		    break;
		case 'k': // The down arrow key was pressed
			see_Z -= 0.03;
		    break;
		case 'w': // The w key was pressed
			//Move Forward
			dir = normalize([see_X - eyePosWorld[0], see_Y - eyePosWorld[1], see_Z - eyePosWorld[2]]);

		    eyePosWorld[0] += dir[0]*intensity;
		    see_X += dir[0]*intensity;
		    eyePosWorld[1] += dir[1]*intensity;
		    see_Y += dir[1]*intensity;
		    eyePosWorld[2] += dir[2]*intensity;
		    see_Z += dir[2]*intensity;
			break;
		case 's': // The S/s key was pressed
			//Move Backwards
			dir = normalize([see_X - eyePosWorld[0], see_Y - eyePosWorld[1], see_Z - eyePosWorld[2]]);
		    eyePosWorld[0] -= dir[0]*intensity;
		    see_X -= dir[0]*intensity;
		    eyePosWorld[1] -= dir[1]*intensity;
		    see_Y -= dir[1]*intensity;
		    eyePosWorld[2] -= dir[2]*intensity;
		    see_Z -= dir[2]*intensity;
		    break;
		case 'd':  // The D/d key was pressed
			//Move Right
			dir = normalize(crossProduct(see_X - eyePosWorld[0], see_Y - eyePosWorld[1], see_Z - eyePosWorld[2], 0, 0, 1));

		    eyePosWorld[0] += dir[0]*intensity;
		    see_X += dir[0]*intensity;
		    eyePosWorld[1] += dir[1]*intensity;
		    see_Y += dir[1]*intensity;
		    eyePosWorld[2] += dir[2]*intensity;
		    see_Z += dir[2]*intensity;
			break;
		case 'a': // The a key was pressed
			//Move Left
			dir = normalize(crossProduct(see_X - eyePosWorld[0], see_Y - eyePosWorld[1], see_Z - eyePosWorld[2], 0, 0, 1));

		    eyePosWorld[0] -= dir[0]*intensity;
		    see_X -= dir[0]*intensity;
		    eyePosWorld[1] -= dir[1]*intensity;
		    see_Y -= dir[1]*intensity;
		    eyePosWorld[2] -= dir[2]*intensity;
		    see_Z -= dir[2]*intensity;
		    break;
	}
}

function onPlusButton() {
//==============================================================================
	INIT_VEL *= 1.2;		// increase
	console.log('Initial velocity: '+INIT_VEL);
}

function onMinusButton() {
//==============================================================================
	INIT_VEL /= 1.2;		// shrink
	console.log('Initial velocity: '+INIT_VEL);
}

function normalize(v){
  var mag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return [v[0]/ mag, v[1]/mag, v[2]/mag];
}
function crossProduct(x1, x2, x3, y1, y2, y3){
  return [x2*y3-x3*y2, x3*y1-x1*y3, x1*y2-x2*y1];
}



function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 100;			// # of lines to draw in x,y to make the grid.
	var ycount = 100;		
	var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array((xcount+ycount)*6*2);
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= 6) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;					// y
			gndVerts[j+2] = 0.0;					// z
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;					// y
			gndVerts[j+2] = 0.0;					// z
		}
		gndVerts[j+3] = 1;			// red
		gndVerts[j+4] = 1;			// grn
		gndVerts[j+5] = 1;			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= 6) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;					// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;					// z
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;					// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;					// z
		}
		gndVerts[j+3] = 1;			// red
		gndVerts[j+4] = 1;			// grn
		gndVerts[j+5] = 1;			// blu
	}
}

function makeBox() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	boxVerts = new Float32Array([
	//	xpos,ypos,zpos,xvel,yvel,zvel,xft,yfor,zfor,red,green,blu,mass,diam,rmode
		0.0, 0.0, 0.0, 0.0, 1.0, 1.0,
		0.0, 0.0, 1.8, 0.0, 1.0, 1.0,

		1.8, 0.0, 0.0, 0.0, 1.0, 1.0,
		1.8, 0.0, 1.8, 0.0, 1.0, 1.0,

		0.0, 1.8, 0.0, 0.0, 1.0, 1.0,
		0.0, 1.8, 1.8, 0.0, 1.0, 1.0,

		1.8, 1.8, 0.0, 0.0, 1.0, 1.0,
		1.8, 1.8, 1.8, 0.0, 1.0, 1.0,

		0.0, 0.0, 1.8, 0.0, 1.0, 1.0,
		1.8, 0.0, 1.8, 0.0, 1.0, 1.0,

		1.8, 0.0, 1.8, 0.0, 1.0, 1.0,
		1.8, 1.8, 1.8, 0.0, 1.0, 1.0,

		1.8, 1.8, 1.8, 0.0, 1.0, 1.0,
		0.0, 1.8, 1.8, 0.0, 1.0, 1.0,

		0.0, 1.8, 1.8, 0.0, 1.0, 1.0,
		0.0, 0.0, 1.8, 0.0, 1.0, 1.0,

		0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 
		1.8, 0.0, 0.0, 0.0, 1.0, 1.0,

		1.8, 0.0, 0.0, 0.0, 1.0, 1.0,
		1.8, 1.8, 0.0, 0.0, 1.0, 1.0,

		1.8, 1.8, 0.0, 0.0, 1.0, 1.0, 
		0.0, 1.8, 0.0, 0.0, 1.0, 1.0, 

		0.0, 1.8, 0.0, 0.0, 1.0, 1.0,
		0.0, 0.0, 0.0, 0.0, 1.0, 1.0,
	])
}

function makeSphere() {
//==============================================================================
  var slices = 12;		// # of slices of the sphere along the z axis. >=3 req'd
											// (choose odd # or prime# to avoid accidental symmetry)
  var sliceVerts	= 50;	// # of vertices around the top edge of the slice
											// (same number of vertices on bottom of slice, too)
  var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.

	// Create a (global) array to hold this sphere's vertices:
  sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * 6);
										// # of vertices * # of elements needed to store them. 
										// each slice requires 2*sliceVerts vertices except 1st and
										// last ones, which require only 2*sliceVerts-1.
										
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		if(s==slices-1) isLast=1;	// skip last vertex of last slice.
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=6) {	
			if(v%2==0)
			{				// put even# vertices at the the slice's top edge
							// (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
							// and thus we can simplify cos(2*PI(v/2*sliceVerts))  
				sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				sphVerts[j+2] = cos0;		
		
			}
			else { 	// put odd# vertices around the slice's lower edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				sphVerts[j+2] = cos1;											// z																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				sphVerts[j+3]= 	1.0; 
				sphVerts[j+4]= 1.0; 
				sphVerts[j+5]= 0.0;	
				}
			else if(s==slices-1) {
				sphVerts[j+3]=	1.0; 
				sphVerts[j+4]=	1.0; 
				sphVerts[j+5]=	0.0;	
			}
			else {
					sphVerts[j+3]=	1.0; 
					sphVerts[j+4]=	1.0; 
					sphVerts[j+5]=	0.0;					
			}
		}
	}
}