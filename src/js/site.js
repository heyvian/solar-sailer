import { siteUI } from './ui';
import { solarSailer } from './webXR';

const XRtype = 'ar'; // ar or vr

siteUI.init(XRtype, solarSailer);

if(navigator.xr) {
    solarSailer.init(XRtype, siteUI);
}