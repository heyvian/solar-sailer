let t=new function UI(t){};t.init=function(e,o){console.log("|||| Init UI"),this.XRtype=e,this.XR=o,this.startXRbtn=document.querySelector(".js-start-webxr"),this.XRsupportedBtnText="Start "+this.XRtype.toUpperCase()+" session",this.XRnotSupportedBtnText=this.XRtype.toUpperCase()+" not supported on this device",navigator.xr?navigator.xr.isSessionSupported("immersive-"+this.XRtype).then((function(e){e?t.immersiveSupported():t.immersiveNotSupported()})).catch(t.immersiveNotSupported.bind(t)):(console.log("%c no navigator.xr","color: #990000"),this.immersiveNotSupported())},t.immersiveSupported=function(){console.log("%c|||| "+this.XRtype.toUpperCase()+" is supported","color: #006600"),this.startXRbtn.textContent=this.XRsupportedBtnText,this.startXRbtn.addEventListener("click",(t=>{this.XR.startXRSession()}))},t.immersiveNotSupported=function(){console.log("%c|||| "+this.XRtype.toUpperCase()+" is not supported","color: #990000"),this.startXRbtn.textContent=this.XRnotSupportedBtnText};export{t as siteUI};