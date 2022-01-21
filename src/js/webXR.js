import * as THREE from 'three';
import gsap from "gsap";
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
        color: '#d4af37',
        metalness: 1,
        roughness: 1,
        clearcoat: 1
      });
    this.cube = new THREE.Mesh( geometry, material );
    this.cube.position.set(0, 1, -1);
    this.scene.add( this.cube );

    initSun();
    setLights();

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

    XR.sun.rotation.x -= 0.0015;
    XR.sun.rotation.y -= 0.0015;
    XR.sun.rotation.z -= 0.0015;

    moveSpacecraft();

    attachSunToViewer();

    // XR.sun.position.set(XR.camera.position);
    // XR.sun.position.set(XR.viewerPosition);

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

function initSun() {
    
    XR.sunGroup = new THREE.Group();
    XR.sunOnColor = new THREE.Color( 0x8b6200 );
    XR.sunOffColor = new THREE.Color( 0x211801 );
    XR.sunColor = XR.sunOffColor;
    const sunGeo = new THREE.SphereBufferGeometry(0.13, 128, 128);
    const sunMat = new THREE.MeshStandardMaterial({
        color: XR.sunColor,
        map: new THREE.TextureLoader().load('dist/images/textures/sun-color-map.jpg'),
        displacementMap: new THREE.TextureLoader().load('dist/images/textures/sun-displacement-map.jpg'),
        displacementScale: 0.003,
        emissiveMap: new THREE.TextureLoader().load('dist/images/textures/sun-displacement-map.jpg'),
        emissiveIntensity: 0.5
      });
    XR.sun = new THREE.Mesh( sunGeo, sunMat );
    XR.sun.name = "Sol";
    XR.sunGroup.add(XR.sun);

	var sunGlowSpriteMat = new THREE.SpriteMaterial( 
    { 
        alphaMap: new THREE.TextureLoader().load('dist/images/textures/glow.png'), 
        color: 0xfdb813, 
    });
    XR.sunGlow = new THREE.Sprite( sunGlowSpriteMat );
    XR.sunGlow.scale.set(0.4, 0.4, 1);

    XR.scene.add(XR.sunGroup);

    XR.sunShining = false;

}

function moveSpacecraft() {
    if(XR.sunShining) {
        XR.camera.getWorldPosition(XR.viewerPosition);

        let speedFactor = 0.008 / XR.viewerPosition.distanceTo(XR.cube.position);
        // speedFactor = 0;
        let direction = new THREE.Vector3();
    
        // XR.cube.getWorldDirection(direction);
        XR.camera.getWorldDirection(direction);
    
        XR.cube.position.add(direction.multiplyScalar(speedFactor));
    } 
}

function attachSunToViewer() {
    var dist = 0.4;
    var cwd = new THREE.Vector3();
            
    XR.camera.getWorldDirection(cwd);
    
    cwd.multiplyScalar(dist);
    cwd.add(XR.camera.position);
    
    XR.sunGroup.position.set(cwd.x, cwd.y - 0.30, cwd.z);
    XR.sunGroup.setRotationFromQuaternion(XR.camera.quaternion);
}

function toggleSunLight() {
    let newColor = new THREE.Color(XR.sunColor.getHex());

    if(XR.sunShining == false) {
        gsap.to(newColor, {r: XR.sunOnColor.r, g: XR.sunOnColor.g, b: XR.sunOnColor.b, duration: 0.4,

            onUpdate: function () {
                console.log(XR.sunColor);
                XR.sun.material.color = newColor;
            }
        });
        // XR.sun.material.emissive = new THREE.Color( 0xfdb813 );
        XR.sunLight.intensity = 20;
        XR.sun.add(XR.sunGlow);
        XR.sunShining = true;
    } else {
        // let newColor = new THREE.Color({r: XR.sunColor.r, g: XR.sunColor.g, b: XR.sunColor.b});
        gsap.to(newColor, {r: XR.sunOffColor.r, g: XR.sunOffColor.g, b: XR.sunOffColor.b, duration: 0.4,

            onUpdate: function () {
                console.log(XR.sunColor);
                XR.sun.material.color = newColor;
            }
        });
        // XR.sun.material.emissive = new THREE.Color( 0x000000 );
        XR.sunLight.intensity = 0;
        XR.sun.remove(XR.sunGlow);
        XR.sunShining = false;
    }
}

function setLights() {
    const ambientLight = new THREE.AmbientLight( 0x404040, 10 ); // soft white light
    XR.scene.add( ambientLight );

    XR.sunLight = new THREE.PointLight( '#fff', 0, 0, 2);
    XR.sunLight.position.set(0, 0, 0);
    // XR.sunLight.lookAt(XR.cube.matrixWorld);
    XR.sunGroup.add(XR.sunLight);
    
    const pointLightHelper = new THREE.PointLightHelper( XR.sunLight, .5 );
    XR.scene.add( pointLightHelper );
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

    }

}

let xrInputSources;

function onInputSourcesChange(e) {
    xrInputSources = e.session.inputSources;
    const inputSource = xrInputSources[0];

    if(inputSource && inputSource.gamepad) {
        const v2 = new THREE.Vector2(inputSource.gamepad.axes[0], inputSource.gamepad.axes[1] * -1);
    
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera( v2,  XR.camera );
        // XR.scene.add(new THREE.ArrowHelper( raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xff0000 ));

        if(raycaster.intersectObject( XR.sun ).length > 0) {
            toggleSunLight();
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