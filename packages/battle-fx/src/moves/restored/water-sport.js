import { Container, Graphics } from 'pixi.js'

export default function waterSport({layer,scene,tl,random,onFrame,onCue}) {
  const {width:w,height:h,unit:u}=scene,art=new Container();art.label='move-artwork';layer.addChild(art)
  const drops=Array.from({length:44},(_,i)=>{const g=new Graphics().ellipse(0,0,2*u,4*u).fill(i%2?0xa0dce8:0xe1f8f4);g.alpha=0;art.addChild(g);const ring=new Graphics();ring.alpha=0;art.addChild(ring);return{g,ring,start:.12+i*.022,x:w*(.16+(i%4)*.225),y:h*(.79-(i%3)*.035),dx:(random()-.5)*w*.17,hop:(45+random()*45)*u,life:.62+random()*.14}})
  function update(time){for(const p of drops){const age=time-p.start,v=Math.max(0,Math.min(1,age/p.life));p.g.alpha=age>=0&&age<p.life?.78:0;p.g.position.set(p.x+p.dx*v,p.y-4*v*(1-v)*p.hop);p.g.rotation=Math.atan2(-4*(1-2*v)*p.hop,p.dx)+Math.PI/2
    const q=(age-p.life)/.5;p.ring.clear();p.ring.alpha=q>=0&&q<1?(1-q)*.65:0;p.ring.position.set(p.x+p.dx,p.y)
    if(q>=0&&q<1){p.ring.ellipse(0,0,(4+q*17)*u,(1.5+q*4)*u).stroke({color:0xc6edf0,width:1.5*u,alpha:.65});for(let j=0;j<3;j++){const a=j*Math.PI*2/3+q*2;p.ring.circle(Math.cos(a)*(5+q*16)*u,Math.sin(a)*(2+q*3)*u,1.5*u).fill(0xe3f9f4)}}}}
  onFrame(update);tl.call(()=>{update(.88);onCue({type:'impact'})},[],.88)
}
