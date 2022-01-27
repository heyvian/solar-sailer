import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import gsap from "gsap";
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min';

function WebXR() { };

let solarSailer = new WebXR();

solarSailer.init = function(XRtype) {
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
    solarSailer.resetCraftBtn = document.querySelector('.js-reset-spacecraft');
    solarSailer.instructions = document.querySelector('.js-overlay-instructions');;
    solarSailer.showInstructions = true;

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

    solarSailer.resetCraftBtn.addEventListener('click', e => {
        resetSpacecraft();
    });

    const geometry = new THREE.SphereBufferGeometry(64, 64, 64);
    const material = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('dist/images/textures/star-map-2.jpg'), 
        side: THREE.BackSide
    });
    solarSailer.sky = new THREE.Mesh( geometry, material );
    solarSailer.scene.add( solarSailer.sky );

    solarSailer.siteCamera.position.z = 0.1;
    solarSailer.siteCamera.position.y = 1;

    buildSpacecraft();
    initSun();
    setupLights();

    solarSailer.animate();

    window.addEventListener('touchstart', onTouch);

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
    session.addEventListener('end', solarSailer.onSessionEnded);

    await solarSailer.renderer.xr.setSession(session);
    solarSailer.currentSession = session;

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

    // solarSailer.initControllers();

}

solarSailer.onSessionEnded = async function() {
    solarSailer.currentSession.removeEventListener('end', solarSailer.onSessionEnded);
    solarSailer.currentSession = null;

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
        solarSailer.controls.autoRotateSpeed = 1;
        solarSailer.controls.rotateSpeed = 0.01;
        solarSailer.controls.enableDamping = true;
        solarSailer.controls.dampingFactor = 0.5;
        solarSailer.controls.minDistance = 1.25;
        solarSailer.controls.maxDistance = 7;
        solarSailer.controls.zoomSpeed = 0.05;
        solarSailer.controls.enablePan = false;
        // solarSailer.controls.maxPolarAngle = Math.PI / 2;
        solarSailer.controls.target = solarSailer.spacecraft.position;

        solarSailer.controls.update();
        solarSailer.renderer.render(solarSailer.scene, solarSailer.siteCamera);

    }
}

solarSailer.initControllers = function() {

    // controllers
    solarSailer.controller1 = solarSailer.renderer.xr.getController( 0 );
    solarSailer.controller1.addEventListener('select', onSelect);
    
    solarSailer.scene.add( solarSailer.controller1 );

}

function buildSpacecraft() {
    solarSailer.spacecraft = new THREE.Group();

    const fuselageGeo = new THREE.BoxBufferGeometry( 0.05, 0.05, 0.1 );
    const fuselageMat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        metalness: 1,
        roughness: 0,
        clearcoat: 0,
        envMap: solarSailer.starMap,
        envMapIntensity: 2
      });
    solarSailer.fuselage = new THREE.Mesh( fuselageGeo, fuselageMat );
    solarSailer.spacecraft.add(solarSailer.fuselage);

    const solarPanelGeo = new THREE.BoxBufferGeometry( 0.048, 0.2, 0.005 );
    const solarPanelMat = new THREE.MeshPhysicalMaterial({
        color: '#11202f',
        metalness: 0.6,
        roughness: 0,
        clearcoat: 0,
        envMap: solarSailer.starMap,
        envMapIntensity: 2
      });
    solarSailer.solarPanel = new THREE.Mesh( solarPanelGeo, solarPanelMat );
    solarSailer.solarPanel.translateZ(0.045);
    solarSailer.spacecraft.add(solarSailer.solarPanel);
    
    const mastGeo = new THREE.BoxBufferGeometry( 0.005, 2, 0.005 );
    const mastMat = new THREE.MeshPhysicalMaterial({
        color: '#111',
        metalness: 0,
        roughness: 1,
        clearcoat: 0,
        precision: 'highp'
    });
    solarSailer.mast1 = new THREE.Mesh( mastGeo, mastMat );
    solarSailer.mast2 = new THREE.Mesh( mastGeo, mastMat );
    solarSailer.mast1.translateZ(-0.042);
    solarSailer.mast2.translateZ(-0.042);
    solarSailer.mast2.rotateZ(THREE.Math.degToRad(90));
    solarSailer.spacecraft.add(solarSailer.mast1);
    solarSailer.spacecraft.add(solarSailer.mast2);
    
    var coordinatesList = [
        new THREE.Vector2(0, 1),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(0, -1),
        new THREE.Vector2(-1, 0),
        new THREE.Vector2(-0.1, 0),
        new THREE.Vector2(0, -0.1),
        new THREE.Vector2(0.1, 0),
        new THREE.Vector2(0, 0.1),
        new THREE.Vector2(-0.1, 0),
        new THREE.Vector2(-1, 0),
      ];

    let sailGeo = new THREE.ShapeBufferGeometry(new THREE.Shape(coordinatesList));

    const sailMat = new THREE.MeshPhysicalMaterial({
        color: '#dddddd',
        metalness: 1,
        roughness: 0.15,
        clearcoat: 1,
        opacity: 0.8,
        transparent: true,
        side: THREE.DoubleSide,
        envMap: solarSailer.starMap,
    });
    solarSailer.sail = new THREE.Mesh( sailGeo, sailMat );
    solarSailer.sail.translateZ(-0.042);
    solarSailer.spacecraft.add(solarSailer.sail);
    
    resetSpacecraft();
    solarSailer.spacecraft.translateY(1);
    solarSailer.scene.add( solarSailer.spacecraft );

    const cameraFacerGeo = new THREE.BoxBufferGeometry( 0.25, 0.25, 0.25 );
    const cameraFacerMat = new THREE.MeshBasicMaterial({
        color: '#000000',
        opacity : 0,
        transparent: true
      });
    solarSailer.cameraFacer = new THREE.Mesh( cameraFacerGeo, cameraFacerMat );
    solarSailer.cameraFacer.visible = false;
    solarSailer.scene.add( solarSailer.cameraFacer );
}

function moveSpacecraft() {
    solarSailer.cameraFacer.position.copy(solarSailer.spacecraft.position);

    if(solarSailer.sunShining) {
        solarSailer.cameraFacer.lookAt(solarSailer.viewerPosition);
        var q1 = new THREE.Quaternion();
        q1.copy(solarSailer.cameraFacer.quaternion);

        solarSailer.spacecraft.quaternion.slerp(q1, 0.05);

        solarSailer.camera.getWorldPosition(solarSailer.viewerPosition);

        let speedFactor = -0.008 / solarSailer.viewerPosition.distanceTo(solarSailer.spacecraft.position);
        solarSailer.spacecraft.translateZ(speedFactor);
    }
}


function resetSpacecraft() {
    var cwd = new THREE.Vector3();
            
    solarSailer.camera.getWorldDirection(cwd);
    
    solarSailer.spacecraft.setRotationFromQuaternion(solarSailer.camera.quaternion);
    
    cwd.add(solarSailer.camera.position);
    
    solarSailer.spacecraft.position.set(cwd.x, cwd.y, cwd.z);
    solarSailer.spacecraft.translateZ(-0.7);
}

function initSun() {
    
    solarSailer.sunGroup = new THREE.Group();
    solarSailer.sunOnColor = new THREE.Color( 0x8b6200 );
    solarSailer.sunOffColor = new THREE.Color( 0x211801 );
    solarSailer.sunColor = solarSailer.sunOffColor;
    const sunGeo = new THREE.SphereBufferGeometry(0.20, 128, 128);
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
    solarSailer.sun.translateY(-0.4);
    solarSailer.sun.translateZ(0.45);
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
    var cwd = new THREE.Vector3();
            
    solarSailer.camera.getWorldDirection(cwd);
    
    solarSailer.sunGroup.setRotationFromQuaternion(solarSailer.camera.quaternion);

    cwd.add(solarSailer.camera.position);
    
    solarSailer.sunGroup.position.set(cwd.x, cwd.y, cwd.z);
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

    hideInstructions();
}

function hideInstructions() {
    solarSailer.showInstructions = false;
    solarSailer.instructions.classList.add('not-visible');
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight( 0x404040, 5 ); // soft white light
    solarSailer.scene.add( ambientLight );

    solarSailer.sunLight = new THREE.PointLight( '#8b6200', 0, 3, 2);
    solarSailer.sunLight.position.set(0, 0, 0);
    // solarSailer.sunLight.lookAt(solarSailer.spacecraft.matrixWorld);
    solarSailer.sunGroup.add(solarSailer.sunLight);
    
    // const pointLightHelper = new THREE.PointLightHelper( solarSailer.sunLight, .5 );
    // solarSailer.scene.add( pointLightHelper );
}

function onTouch(e) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    pointer.x = ( e.targetTouches[0].clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( e.targetTouches[0].clientY / window.innerHeight ) * 2 + 1;

    raycaster.setFromCamera( pointer, solarSailer.camera );
    // const arrowHelper = new THREE.ArrowHelper( raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xffffff );
    // solarSailer.scene.add( arrowHelper );

    if(raycaster.intersectObject( solarSailer.sun ).length > 0) {
        toggleSunLight();
    }

}

function onSelect(e) {
    console.log('onSelect()');
    console.log(e);
    const input = e.data;

    if(solarSailer.XRtype == 'ar') {
        let touchX = input.gamepad.axes[0];
        let touchY = input.gamepad.axes[1] * -1;
        alert(input.gamepad.axes);
        const v2 = new THREE.Vector2(touchX, touchY);
        const raycaster = new THREE.Raycaster();

        raycaster.setFromCamera( v2,  solarSailer.camera );

        if(raycaster.intersectObject( solarSailer.sun ).length > 0) {
            toggleSunLight();
        }

    }

}

// let xrInputSources;

// function onInputSourcesChange(e) {
//     xrInputSources = e.session.inputSources;
//     const inputSource = xrInputSources[0];

//     if(inputSource && inputSource.gamepad) {
//         const v2 = new THREE.Vector2(inputSource.gamepad.axes[0], inputSource.gamepad.axes[1] * -1);
    
//         const raycaster = new THREE.Raycaster();
//         raycaster.setFromCamera( v2,  solarSailer.camera );

//         if(raycaster.intersectObject( solarSailer.sun ).length > 0) {
//             toggleSunLight();
//         }

//     }
// }

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