import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min';

function WebXR() { };

let solarSailer = new WebXR();

solarSailer.init = function(XRtype) {
    console.log('|||| Init WebXR');
    solarSailer.XRtype = XRtype;
    solarSailer.container = document.querySelector('.js-xr-container');
    solarSailer.camera;
    solarSailer.siteCamera;
    solarSailer.gl;
    solarSailer.scene;
    solarSailer.controls;
    solarSailer.renderer;
    solarSailer.referenceSpace;
    solarSailer.hitTestSource;
    solarSailer.viewerPosition = new THREE.Vector3();
    solarSailer.session;
    solarSailer.currentSession = null;
    solarSailer.controller;
    solarSailer.overlay = document.querySelector('.js-ar-overlay');
    solarSailer.closeXRbtn = document.querySelector('.js-close-webxr');

    solarSailer.camera = new THREE.PerspectiveCamera();
    solarSailer.camera.matrixAutoUpdate = false;
    solarSailer.siteCamera = new THREE.PerspectiveCamera(45, window.innerHeight / window.innerWidth, 1, 200);
    solarSailer.scene = new THREE.Scene();

    solarSailer.textureLoader = new THREE.TextureLoader();
    solarSailer.starMap = solarSailer.textureLoader.load( 'dist/images/textures/star-map-3.jpg' );
    solarSailer.starMap.mapping = THREE.EquirectangularReflectionMapping;
    solarSailer.starMap.encoding = THREE.sRGBEncoding;

    solarSailer.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        outputEncoding: THREE.sRGBEncoding
    });
    solarSailer.renderer.setPixelRatio(window.devicePixelRatio);
    solarSailer.renderer.setSize(document.body.clientWidth, document.body.clientHeight);
    solarSailer.renderer.xr.enabled = true;
    solarSailer.container.appendChild(solarSailer.renderer.domElement);

    if(solarSailer.XRtype == 'ar') {
        solarSailer.session = {
            requiredFeatures: ['local-floor', 'hit-test']
        };
    } else if (solarSailer.XRtype == 'vr') {
        solarSailer.session = {
            optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking', 'hit-test' ]
        };
    }

    if (solarSailer.session.domOverlay === undefined && solarSailer.XRtype == 'ar') {

        if ( solarSailer.session.optionalFeatures === undefined) {
            solarSailer.session.optionalFeatures = [];
        }

        solarSailer.session.optionalFeatures.push('dom-overlay');
        solarSailer.session.domOverlay = {
            root: solarSailer.overlay
        };

    }

    solarSailer.closeXRbtn.addEventListener('click', e => {
        solarSailer.currentSession.end();
    });

    const geometry = new THREE.SphereBufferGeometry(100, 64, 64);
    const material = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('dist/images/textures/star-map-2.jpg'), 
        side: THREE.BackSide
    });
    solarSailer.sky = new THREE.Mesh( geometry, material );
    solarSailer.scene.add( solarSailer.sky );

    solarSailer.siteCamera.position.z = 5;

    buildSpacecraft();
    initSun();
    setupLights();

    solarSailer.animate();

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

solarSailer.startXRSession = function() {
    if (solarSailer.currentSession === null) {
        navigator.xr.requestSession('immersive-' + solarSailer.XRtype, solarSailer.session).then(solarSailer.onSessionStarted);
    }
}

solarSailer.onSessionStarted = async function(session) {
    console.log('|||| ' + solarSailer.XRtype.toUpperCase() + ' session started');
    // solarSailer.animate();
    session.addEventListener('end', solarSailer.onSessionEnded);

    await solarSailer.renderer.xr.setSession(session);
    solarSailer.currentSession = session;

    // solarSailer.camera = new THREE.PerspectiveCamera();
    // solarSailer.camera.matrixAutoUpdate = false;

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    solarSailer.referenceSpace = await solarSailer.currentSession.requestReferenceSpace("local-floor").catch(e => {
        console.error(e)
    });

    // Create another XRReferenceSpace that has the viewer as the origin.
    solarSailer.viewerSpace = await solarSailer.currentSession.requestReferenceSpace('viewer').catch(e => {
        console.error(e)
    });

    if(solarSailer.XRtype == 'ar') {
        // Perform hit testing using the viewer as origin.
        solarSailer.hitTestSource = await solarSailer.currentSession.requestHitTestSource({
            space: solarSailer.viewerSpace
        }).catch(e => {
            console.error(e)
        });
    }

    document.querySelector('body').classList.add('has-xr');
    
    if(solarSailer.XRtype == 'ar') {
        document.querySelector('body').classList.add('has-ar');
    }

    solarSailer.initControllers();
    
    session.addEventListener('inputsourceschange', onInputSourcesChange);

}

solarSailer.onSessionEnded = async function() {
    solarSailer.currentSession.removeEventListener('end', solarSailer.onSessionEnded);
    solarSailer.currentSession = null;
    // solarSailer.stopAnimate();

    document.querySelector('body').classList.remove('has-xr', 'has-ar', 'has-vr');
}

solarSailer.animate = function() {
    solarSailer.renderer.setAnimationLoop(solarSailer.render);
}

solarSailer.stopAnimate = function() {
    solarSailer.renderer.setAnimationLoop(null);
}

solarSailer.render = function(time, frame) {

    if(solarSailer.sun) {
        solarSailer.sun.rotation.x -= 0.0015;
        solarSailer.sun.rotation.y -= 0.0015;
        solarSailer.sun.rotation.z -= 0.0015;
    }

    if (solarSailer.renderer.xr.isPresenting) {
        solarSailer.sky.visible = false;
        solarSailer.sun.visible = true;
        attachSunToViewer();

        moveSpacecraft();

        const pose = frame.getViewerPose(solarSailer.referenceSpace);
        if (pose) {
            // In mobile XR, we only have one view.
            const view = pose.views[0];

            if(solarSailer.XRtype == 'ar') {
                // Use the view's transform matrix and projection matrix to configure the THREE.camera.
                solarSailer.camera.matrix.fromArray(view.transform.matrix);
                solarSailer.camera.projectionMatrix.fromArray(view.projectionMatrix);
                solarSailer.camera.updateMatrixWorld(true);

                const hitTestResults = frame.getHitTestResults(solarSailer.hitTestSource);

                if (hitTestResults.length > 0) {
                    
                } else {

                }
            }

            // Render the scene with THREE.WebGLRenderer.
            solarSailer.renderer.render(solarSailer.scene, solarSailer.camera);
        }
    } else {
        solarSailer.sky.visible = true;
        solarSailer.sun.visible = false;
        solarSailer.controls = new OrbitControls(solarSailer.siteCamera, solarSailer.renderer.domElement);
        solarSailer.controls.autoRotate = true;
        solarSailer.controls.autoRotateSpeed = 0.25;
        solarSailer.controls.rotateSpeed = 0.1;
        solarSailer.controls.dampingFactor = 0.5;
        solarSailer.controls.minZoom = 1;
        solarSailer.controls.maxZoom = 5;
        solarSailer.controls.zoomSpeed = 0.05;
        solarSailer.controls.enablePan = false;
        // solarSailer.controls.maxPolarAngle = Math.PI / 2;
        solarSailer.controls.target = solarSailer.spacecraft.position;

        solarSailer.controls.update();
        solarSailer.renderer.render(solarSailer.scene, solarSailer.siteCamera);

    }
}

solarSailer.initControllers = function() {

    console.log(solarSailer.currentSession);

    // controllers
    solarSailer.controller1 = solarSailer.renderer.xr.getController( 0 );
    solarSailer.controller1.addEventListener('select', onSelect);
    
    solarSailer.scene.add( solarSailer.controller1 );

}

function buildSpacecraft() {
    solarSailer.spacecraft = new THREE.Group();

    const fuselageGeo = new THREE.BoxBufferGeometry( 0.05, 0.05, 0.15 );
    const fuselageMat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        metalness: 1,
        roughness: 0,
        clearcoat: 1,
        envMap: solarSailer.starMap,
        envMapIntensity: 2
      });
    solarSailer.fuselage = new THREE.Mesh( fuselageGeo, fuselageMat );
    solarSailer.spacecraft.add(solarSailer.fuselage);
    
    const mastGeo = new THREE.BoxBufferGeometry( 0.01, 2, 0.01 );
    const mastMat = new THREE.MeshPhysicalMaterial({
        color: '#504f53',
        metalness: 0,
        roughness: 1,
        clearcoat: 0,
        precision: 'highp'
    });
    solarSailer.mast1 = new THREE.Mesh( mastGeo, mastMat );
    solarSailer.mast2 = new THREE.Mesh( mastGeo, mastMat );
    solarSailer.mast1.translateZ(-0.06);
    solarSailer.mast2.translateZ(-0.06);
    solarSailer.mast2.rotateZ(THREE.Math.degToRad(90));
    solarSailer.spacecraft.add(solarSailer.mast1);
    solarSailer.spacecraft.add(solarSailer.mast2);
    

    const sailGeo = new THREE.PlaneBufferGeometry( 1.4, 1.4);
    const sailMat = new THREE.MeshPhysicalMaterial({
        color: '#000000',
        metalness: 1,
        roughness: 0,
        clearcoat: 1,
        opacity: 0.4,
        transparent: true,
        side: THREE.DoubleSide,
        envMap: solarSailer.starMap,
        metalnessMap: new THREE.TextureLoader().load('dist/images/textures/sail-reflection-map.jpg'),
    });
    solarSailer.sail = new THREE.Mesh( sailGeo, sailMat );
    solarSailer.sail.translateZ(-0.06);
    solarSailer.sail.rotateZ(THREE.Math.degToRad(45));
    solarSailer.spacecraft.add(solarSailer.sail);
    
    solarSailer.spacecraft.position.set(0, solarSailer.siteCamera.position.y + 1.2, -1);
    solarSailer.scene.add( solarSailer.spacecraft );

    const cameraFacerGeo = new THREE.BoxBufferGeometry( 0.25, 0.25, 0.25 );
    const cameraFacerMat = new THREE.MeshBasicMaterial({
        color: '#000000',
        opacity : 0,
        transparent: true
      });
    solarSailer.cameraFacer = new THREE.Mesh( cameraFacerGeo, cameraFacerMat );
    solarSailer.scene.add( solarSailer.cameraFacer );
}

function moveSpacecraft() {
    solarSailer.cameraFacer.position.copy(solarSailer.spacecraft.position);

    if(solarSailer.sunShining) {
        solarSailer.cameraFacer.lookAt(solarSailer.sunGroup.position);
        var q1 = new THREE.Quaternion();
        q1.copy(solarSailer.cameraFacer.quaternion);

        solarSailer.spacecraft.quaternion.slerp(q1, 0.05);

        solarSailer.camera.getWorldPosition(solarSailer.viewerPosition);

        let speedFactor = -0.008 / solarSailer.viewerPosition.distanceTo(solarSailer.spacecraft.position);
        solarSailer.spacecraft.translateZ(speedFactor);
    }
}

function initSun() {
    
    solarSailer.sunGroup = new THREE.Group();
    solarSailer.sunOnColor = new THREE.Color( 0x8b6200 );
    solarSailer.sunOffColor = new THREE.Color( 0x211801 );
    solarSailer.sunColor = solarSailer.sunOffColor;
    const sunGeo = new THREE.SphereBufferGeometry(0.13, 128, 128);
    const sunMat = new THREE.MeshStandardMaterial({
        color: solarSailer.sunColor,
        map: new THREE.TextureLoader().load('dist/images/textures/sun-color-map.jpg'),
        displacementMap: new THREE.TextureLoader().load('dist/images/textures/sun-displacement-map.jpg'),
        displacementScale: 0.003,
        emissiveMap: new THREE.TextureLoader().load('dist/images/textures/sun-displacement-map.jpg'),
        emissiveIntensity: 0.5
      });
    //   const sunMat = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    solarSailer.sun = new THREE.Mesh( sunGeo, sunMat );
    solarSailer.sun.name = "Sol";
    solarSailer.sunGroup.add(solarSailer.sun);

	var sunGlowSpriteMat = new THREE.SpriteMaterial( 
    { 
        alphaMap: new THREE.TextureLoader().load('dist/images/textures/glow.png'), 
        color: 0xfdb813, 
    });
    solarSailer.sunGlow = new THREE.Sprite( sunGlowSpriteMat );
    solarSailer.sunGlow.scale.set(0.4, 0.4, 1);
    // solarSailer.sunGroup.position.set(0, 0, -1);
    solarSailer.scene.add(solarSailer.sunGroup);

    solarSailer.sunShining = false;

}

function attachSunToViewer() {
    var dist = 0.4;
    var cwd = new THREE.Vector3();
            
    solarSailer.camera.getWorldDirection(cwd);
    
    cwd.multiplyScalar(dist);
    cwd.add(solarSailer.camera.position);
    
    solarSailer.sunGroup.position.set(cwd.x, cwd.y - 0.30, cwd.z);
}

function toggleSunLight() {
    let updateSunColor = new THREE.Color(solarSailer.sunColor.getHex());

    if(solarSailer.sunShining == false) {
        gsap.to(updateSunColor, {r: solarSailer.sunOnColor.r, g: solarSailer.sunOnColor.g, b: solarSailer.sunOnColor.b, duration: 0.4,

            onUpdate: function () {
                solarSailer.sunColor = updateSunColor;
                solarSailer.sun.material.color = updateSunColor;
            }
        });
        solarSailer.sun.material.emissive = new THREE.Color( 0xfdb813 );
        solarSailer.sunLight.intensity = 1;
        solarSailer.sun.add(solarSailer.sunGlow);
        solarSailer.sunShining = true;
    } else {
        gsap.to(updateSunColor, {r: solarSailer.sunOffColor.r, g: solarSailer.sunOffColor.g, b: solarSailer.sunOffColor.b, duration: 0.4,

            onUpdate: function () {
                solarSailer.sunColor = updateSunColor;
                solarSailer.sun.material.color = updateSunColor;
            }
        });
        solarSailer.sun.material.emissive = new THREE.Color( 0x000000 );
        solarSailer.sunLight.intensity = 0;
        solarSailer.sun.remove(solarSailer.sunGlow);
        solarSailer.sunShining = false;
    }
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight( 0x404040, 5 ); // soft white light
    solarSailer.scene.add( ambientLight );

    solarSailer.sunLight = new THREE.PointLight( '#fff', 0, 3, 2);
    solarSailer.sunLight.position.set(0, 0, 0);
    // solarSailer.sunLight.lookAt(solarSailer.spacecraft.matrixWorld);
    solarSailer.sunGroup.add(solarSailer.sunLight);
    
    // const pointLightHelper = new THREE.PointLightHelper( solarSailer.sunLight, .5 );
    // solarSailer.scene.add( pointLightHelper );
}

function onSelect(e) {
    console.log('onSelect()');

    if(solarSailer.XRtype == 'ar') {
        // Some rasting for AR
        const dir = new THREE.Vector3( 1, 2, 0 );
        solarSailer.camera.getWorldDirection(dir)
        const raycaster = new THREE.Raycaster();

        // console.log(solarSailer.controller1);

        // Setup racaster
        raycaster.setFromCamera( solarSailer.viewerPosition,  solarSailer.camera );
        // Update it to use the proper direction
        raycaster.set(solarSailer.viewerPosition, dir);

    }

}

let xrInputSources;

function onInputSourcesChange(e) {
    xrInputSources = e.session.inputSources;
    const inputSource = xrInputSources[0];

    if(inputSource && inputSource.gamepad) {
        const v2 = new THREE.Vector2(inputSource.gamepad.axes[0], inputSource.gamepad.axes[1] * -1);
    
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera( v2,  solarSailer.camera );
        // solarSailer.scene.add(new THREE.ArrowHelper( raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xff0000 ));

        if(raycaster.intersectObject( solarSailer.sun ).length > 0) {
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

function onWindowResize() {
    if (!solarSailer.renderer.xr.isPresenting) {
        if(solarSailer.siteCamera) {
            solarSailer.siteCamera.aspect = solarSailer.container.clientWidth / solarSailer.container.clientHeight;
            solarSailer.siteCamera.updateProjectionMatrix();
        }

        solarSailer.renderer.setSize(solarSailer.container.clientWidth, solarSailer.container.clientHeight);
    }

}

export { solarSailer };