(() => {
 const header=document.querySelector('.site-header, .pricing-header');
 if(!header)return;
 let last=Math.max(0,scrollY),dir=0,distance=0,queued=false;
 const show=()=>header.classList.remove('scroll-header-hidden');
 function update(){
  queued=false;
  const y=Math.max(0,scrollY),delta=y-last;last=y;
  if(y<85||header.querySelector('.nav.open')){dir=0;distance=0;show();return}
  if(Math.abs(delta)<1.5)return;
  const next=Math.sign(delta);
  if(next!==dir){dir=next;distance=0}
  distance+=Math.abs(delta);
  if(distance<12)return;
  header.classList.toggle('scroll-header-hidden',dir>0);
  distance=0;
 }
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});
 header.addEventListener('focusin',show);
 header.addEventListener('click',event=>{if(event.target.closest('.menu-toggle'))show()});
 addEventListener('hashchange',show);
 addEventListener('resize',()=>{last=Math.max(0,scrollY);dir=0;distance=0;show()},{passive:true});
 addEventListener('pageshow',()=>{last=Math.max(0,scrollY);show()});
})();
