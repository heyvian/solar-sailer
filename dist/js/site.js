import {siteUI}from'./ui.js';import {solarSailer}from'./webXR.js';const XRtype = 'ar'; // ar or vr

siteUI.init(XRtype, solarSailer);

if(navigator.xr) {
    solarSailer.init(XRtype, siteUI);
}