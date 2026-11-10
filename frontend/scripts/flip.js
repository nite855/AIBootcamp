window.DiaryFlip = Object.freeze({ bind(app) {
window.DiaryFlipObserver?.disconnect();
const observer = new ResizeObserver(entries => entries.forEach(({target}) => {
  const scene = target.querySelector('.flip-scene');
  if (!scene) return;
  const width = Math.max(0, Math.min(360, target.clientWidth - 32, (target.clientHeight - 32) * 2 / 3));
  scene.style.width = width + 'px';
  scene.style.height = width * 1.5 + 'px';
}));
window.DiaryFlipObserver = observer;
app.querySelectorAll('.card-box').forEach(el => observer.observe(el));
const resets=[];
window.removeEventListener("cardex-theme-change",window.DiaryFlipReset);
window.DiaryFlipReset=()=>resets.forEach(reset=>reset());
window.addEventListener("cardex-theme-change",window.DiaryFlipReset);
app.querySelectorAll(".flip-scene").forEach(scene=>{
      const tilt=scene.querySelector(".tilt-layer"), front=scene.querySelector(".flip-front"), rear=scene.querySelector(".flip-back");
      const frontButton=front.querySelector("button"), text=rear.querySelector(".flip-text");
      const hover=matchMedia("(hover: hover) and (pointer: fine)");
      const effectsOff=()=>document.documentElement.dataset.motion==="off";
      let frame=0, point=null, active=null, timer=0, suppressTap=false;
      function reset(){if(frame)cancelAnimationFrame(frame);frame=0;point=null;tilt.style.setProperty("--tilt-x","0deg");tilt.style.setProperty("--tilt-y","0deg");tilt.style.setProperty("--shine","0");}
      resets.push(reset);
      function clearHold(){if(timer)clearTimeout(timer);timer=0;}
      function flip(back){clearHold();reset();scene.classList.toggle("flipped",back);front.setAttribute("aria-hidden",String(back));rear.setAttribute("aria-hidden",String(!back));rear.inert=!back;front.inert=back;frontButton.tabIndex=back?-1:0;rear.tabIndex=back?0:-1;text.tabIndex=back?0:-1;(back?rear:frontButton).focus({preventScroll:true});}
      function selectedText(){const s=window.getSelection();return Boolean(s && !s.isCollapsed && (rear.contains(s.anchorNode)||rear.contains(s.focusNode)));}
      frontButton.addEventListener("click",e=>{if(e.detail!==0 && suppressTap){suppressTap=false;return;}flip(true);});
      rear.addEventListener("click",e=>{if(e.target.closest("button"))return;if((e.detail!==0 && suppressTap)||selectedText()){suppressTap=false;return;}flip(false);});
      rear.addEventListener("keydown",e=>{if(e.target===rear && (e.key==="Enter"||e.key===" ")){e.preventDefault();flip(false);}});
      function renderLight(e){
        if(effectsOff())return;
        point={x:e.clientX,y:e.clientY};
        if(frame)return;
        frame=requestAnimationFrame(()=>{
          frame=0;if(!point||!scene.isConnected||effectsOff())return;
          const r=scene.getBoundingClientRect();if(!r.width||!r.height)return;
          const x=Math.max(0,Math.min(1,(point.x-r.left)/r.width)),y=Math.max(0,Math.min(1,(point.y-r.top)/r.height));
          tilt.style.setProperty("--tilt-x",((.5-y)*18).toFixed(2)+"deg");
          tilt.style.setProperty("--tilt-y",((x-.5)*18).toFixed(2)+"deg");
          tilt.style.setProperty("--light-x",(x*100).toFixed(1)+"%");
          tilt.style.setProperty("--rear-light-x",((1-x)*100).toFixed(1)+"%");
          tilt.style.setProperty("--light-y",(y*100).toFixed(1)+"%");
          tilt.style.setProperty("--shine","1");
        });
      }
      scene.addEventListener("pointerdown",e=>{
        if(e.pointerType!=="touch"||!e.isPrimary)return;
        clearHold();reset();suppressTap=false;
        active={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,held:false,body:!!e.target.closest(".flip-text"),scrollTop:text.scrollTop};
        // Keep native touch events on the face while the artwork tilts beneath the finger.
        if(!active.body && e.target.hasPointerCapture(e.pointerId)){
          (scene.classList.contains("flipped")?rear:frontButton).setPointerCapture(e.pointerId);
        }
        if(!active.body){renderLight(e);const gesture=active;timer=setTimeout(()=>{timer=0;if(active===gesture)gesture.held=true;},500);}
      });
      scene.addEventListener("pointermove",e=>{
        if(e.pointerType==="mouse"&&hover.matches){renderLight(e);return;}
        if(e.pointerType!=="touch"||!active||active.id!==e.pointerId)return;
        if(Math.hypot(e.clientX-active.x,e.clientY-active.y)>8){active.moved=true;if(!active.held)clearHold();}
        if(!active.body)renderLight(e);
      });
      scene.addEventListener("pointerup",e=>{
        if(e.pointerType!=="touch"||!active||active.id!==e.pointerId)return;
        suppressTap=active.held||active.moved||text.scrollTop!==active.scrollTop;
        clearHold();active=null;reset();
      });
      scene.addEventListener("pointercancel",e=>{if(active&&active.id===e.pointerId){suppressTap=true;active=null;}clearHold();reset();});
      scene.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse")reset();});
      scene.addEventListener("contextmenu",e=>{if(active && !active.body)e.preventDefault();});
    });
} });
