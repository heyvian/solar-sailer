import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';

function WebXR() { };

let XR = new WebXR();

XR.init = function(XRtype) {
    console.log('|||| Init WebXR');
    this.XRtype = XRtype;
    this.container = document.querySelector('.js-xr-container');
    this.camera;
    this.gl;
    this.scene;
    this.controls;
    this.renderer;
    this.referenceSpace;
    this.hitTestSource;
    this.viewerPosition = new THREE.Vector3();
    this.session;
    this.currentSession = null;
    this.controller;
    this.overlay = document.querySelector('.js-ar-overlay');
    this.closeXRbtn = document.querySelector('.js-close-webxr');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerHeight / window.innerWidth, 1, 200);

    const geometry = new THREE.BoxBufferGeometry( 0.5, 0.5, 0.5 );
    const material = new THREE.MeshPhysicalMaterial({
        color: '#41591D',
        metalness: 1,
        roughness: 0,
        clearcoat: 1
      });
    this.cube = new THREE.Mesh( geometry, material );
    this.cube.position.set(0, 1, -1);

    const sunGeo = new THREE.SphereBufferGeometry(0.1, 32, 32);
    const sunMat = new THREE.MeshStandardMaterial({
        color: '#fdb813',
        flatShading: true,
      });
    this.sun = new THREE.Mesh( sunGeo, sunMat );
    this.sun.name = "Sol";
    this.sunShining = false;

    // SUPER SIMPLE GLOW EFFECT
	// use sprite because it appears the same from all angles
	var spriteMaterial = new THREE.SpriteMaterial( 
        { 
            alphaMap: new THREE.TextureLoader().load('dist/images/textures/glow.png'), 
            // useScreenCoordinates: false, 
            color: 0xfdb813, 
            // transparent: false, 
            // blending: THREE.AdditiveBlending
        });
        this.sunGlow = new THREE.Sprite( spriteMaterial );
        this.sunGlow.scale.set(0.52, 0.52, 0.22);
        // this.sun.add(sunGlow); // this centers the glow at the mesh

    this.scene.add( this.cube );
    this.scene.add(  this.sun);

    XR.sunLight = new THREE.PointLight( '#fff', 20, 0, 2);
    XR.sunLight.position.set(2, 2, 0);
    // XR.sunLight.lookAt(this.cube.matrixWorld);
    this.scene.add(XR.sunLight);


    this.scene.add( new THREE.AmbientLight( '#fff', 0.25 ) );

    this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(document.body.clientWidth, document.body.clientHeight);
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Raycaster

    
    // Some rasting for AR
    const dir = new THREE.Vector3();
    XR.camera.getWorldDirection(dir)
    XR.lightRaycaster = new THREE.Raycaster();

    // Setup racaster
    // XR.lightRaycaster.setFromCamera( XR.viewerPosition,  XR.camera );
    // Update it to use the proper direction
    // XR.lightRaycaster.set(XR.viewerPosition, dir);

    // Add an arrow helper to show the raycaster
    XR.arrowHelper = new THREE.ArrowHelper( XR.lightRaycaster.ray.direction, XR.lightRaycaster.ray.origin, 100, 0x00ffff );
    XR.scene.add(XR.arrowHelper);

    // calculate objects intersecting the picking ray
    const intersects = XR.lightRaycaster.intersectObjects( XR.scene.children );

    for ( let i = 0; i < intersects.length; i ++ ) {

        intersects[ i ].object.material.color.set( Math.random() * 0xffffff );

    }

    if(this.XRtype == 'ar') {
        this.session = {
            requiredFeatures: ['local-floor', 'hit-test']
        };
    } else if (this.XRtype == 'vr') {
        this.session = {
            optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking', 'hit-test' ]
        };
    }

    if (this.session.domOverlay === undefined && this.XRtype == 'ar') {

        if ( this.session.optionalFeatures === undefined) {
            this.session.optionalFeatures = [];
        }

        this.session.optionalFeatures.push('dom-overlay');
        this.session.domOverlay = {
            root: this.overlay
        };

    }

    this.closeXRbtn.addEventListener('click', e => {
        this.currentSession.end();
    });
}

XR.startXRSession = function() {
    if (this.currentSession === null) {
        navigator.xr.requestSession('immersive-' + XR.XRtype, this.session).then(XR.onSessionStarted);
    }
}

XR.onSessionStarted = async function(session) {
    console.log('|||| ' + XR.XRtype.toUpperCase() + ' session started');
    XR.animate();
    session.addEventListener('end', XR.onSessionEnded);

    await XR.renderer.xr.setSession(session);
    XR.currentSession = session;

    XR.camera = new THREE.PerspectiveCamera();
    XR.camera.matrixAutoUpdate = false;

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    XR.referenceSpace = await XR.currentSession.requestReferenceSpace("local-floor").catch(e => {
        console.error(e)
    });

    // Create another XRReferenceSpace that has the viewer as the origin.
    XR.viewerSpace = await XR.currentSession.requestReferenceSpace('viewer').catch(e => {
        console.error(e)
    });

    if(XR.XRtype == 'ar') {
        // Perform hit testing using the viewer as origin.
        XR.hitTestSource = await XR.currentSession.requestHitTestSource({
            space: XR.viewerSpace
        }).catch(e => {
            console.error(e)
        });
    }

    document.querySelector('body').classList.add('has-xr');
    
    if(XR.XRtype == 'ar') {
        document.querySelector('body').classList.add('has-ar');
    }

    XR.initControllers();
    
    session.addEventListener('inputsourceschange', onInputSourcesChange);

}

XR.onSessionEnded = async function() {
    XR.currentSession.removeEventListener('end', XR.onSessionEnded);
    XR.currentSession = null;

    document.querySelector('body').classList.remove('has-xr', 'has-ar', 'has-vr');
}

XR.animate = function() {
    XR.renderer.setAnimationLoop(XR.render);
}

XR.render = function(time, frame) {

    XR.camera.getWorldPosition(XR.viewerPosition);

    let speedFactor = 0.008 / XR.viewerPosition.distanceTo(XR.cube.position);
    // speedFactor = 0;
    let direction = new THREE.Vector3();

    // XR.cube.getWorldDirection(direction);
    XR.camera.getWorldDirection(direction);

    XR.cube.position.add(direction.multiplyScalar(speedFactor));
    // XR.sun.position.set(XR.camera.position);
    // XR.sun.position.set(XR.viewerPosition);

    
    var dist = 0.5;
    var cwd = new THREE.Vector3();
            
    XR.camera.getWorldDirection(cwd);
    
    cwd.multiplyScalar(dist);
    cwd.add(XR.camera.position);
    
    XR.sun.position.set(cwd.x, cwd.y - 0.25, cwd.z);
    XR.sunLight.position.set(cwd.x, cwd.y - 0.25, cwd.z);

    // Update raycaster
    // XR.lightRaycaster.set(XR.cube.position,  XR.camera );
    // Update it to use the proper direction
    // console.log(XR.cube.position, direction);
    // XR.lightRaycaster.setFromCamera(0, direction);
    // XR.arrowHelper.setDirection(XR.lightRaycaster.ray.direction);

    
    // Setup racaster
    const v2 = new THREE.Vector2(0, 0);
    XR.lightRaycaster.setFromCamera( v2,  XR.camera );
    // Update it to use the proper direction
    // console.log(XR.viewerPosition);
    // XR.lightRaycaster.set( XR.camera, direction);
    
    XR.arrowHelper.setDirection(XR.lightRaycaster.ray.direction);

    

    if (XR.renderer.xr.isPresenting) {
        const pose = frame.getViewerPose(XR.referenceSpace);
        if (pose) {
            // In mobile XR, we only have one view.
            const view = pose.views[0];

            if(XR.XRtype == 'ar') {
                // Use the view's transform matrix and projection matrix to configure the THREE.camera.
                XR.camera.matrix.fromArray(view.transform.matrix);
                XR.camera.projectionMatrix.fromArray(view.projectionMatrix);
                XR.camera.updateMatrixWorld(true);

                const hitTestResults = frame.getHitTestResults(XR.hitTestSource);

                if (hitTestResults.length > 0) {
                    
                } else {

                }
            }

            // Render the scene with THREE.WebGLRenderer.
            XR.renderer.render(XR.scene, XR.camera);
        }
    }
}

XR.initControllers = function() {

    console.log(XR.currentSession);

    // controllers
    XR.controller1 = XR.renderer.xr.getController( 0 );
    XR.controller1.addEventListener('select', onSelect);
    
    XR.scene.add( XR.controller1 );

}

function onSelect(e) {
    console.log('onSelect()');

    if(XR.XRtype == 'ar') {
        // Some rasting for AR
        const dir = new THREE.Vector3( 1, 2, 0 );
        XR.camera.getWorldDirection(dir)
        const raycaster = new THREE.Raycaster();

        // console.log(XR.controller1);

        // Setup racaster
        raycaster.setFromCamera( XR.viewerPosition,  XR.camera );
        // Update it to use the proper direction
        raycaster.set(XR.viewerPosition, dir);

        // Add an arrow helper to show the raycaster
        // XR.scene.add(new THREE.ArrowHelper( raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xffffff ));

        // calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects( XR.scene.children );

        for ( let i = 0; i < intersects.length; i ++ ) {

            intersects[ i ].object.material.color.set( Math.random() * 0xffffff );

        }
    }
}
let xrInputSources;
function onInputSourcesChange(e) {
    xrInputSources = e.session.inputSources;
    const inputSource = xrInputSources[0];

    if(inputSource && inputSource.gamepad) {
        const v2 = new THREE.Vector2(inputSource.gamepad.axes[0], inputSource.gamepad.axes[1] * -1);
        console.log(inputSource.gamepad.axes);
    
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera( v2,  XR.camera );
        XR.scene.add(new THREE.ArrowHelper( raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xff0000 ));
    
        const intersects = raycaster.intersectObject( XR.sun );

        console.log(raycaster.intersectObject( XR.sun ));

        if(raycaster.intersectObject( XR.sun ).length > 0) {
            console.log('Icarus');
            // XR.sun.material.opacity = 0.5 ;
            if(XR.sunShining == false) {
                // XR.sun.setValues({emissive: '#fdb813'});
                // XR.sun.material.emissive = '#fdb813';
                XR.sun.add(XR.sunGlow);
                // XR.sun.material.opacity = 1 ;
                XR.sunShining = true;
            } else {
                // XR.sun.material.opacity = 0.5 ;
                // XR.sun.material.emissive = '#000';
                
                XR.sun.remove(XR.sunGlow);
                // XR.sun.setValues({emissive: '#000000'});
                XR.sunShining = false;
            }
        }

    }
}

function onPinchStartLeft( event ) {
    console.log('onPinchStartLeft()');
}

function onPinchEndLeft( event ) {
    console.log('onPinchEndLeft()');
}

function onPinchStartRight( event ) {
    console.log('onPinchStartRight()');
}

function onPinchEndRight( event ) {
    console.log('onPinchEndRight()');
}

export { XR };