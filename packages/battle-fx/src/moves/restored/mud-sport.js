import { Container, Graphics } from 'pixi.js'

export default function mudSport({layer,scene,tl,random,onFrame,onCue}) {
  const {width:w,height:h,unit:u}=scene,art=new Container();art.label='move-artwork';layer.addChild(art)
  const grains=Array.from({length:38},(_,i)=>{const g=new Graphics().poly([-3,-2,2,-3,4,1,0,3,-3,1]).fill(i%2?0x9d7853:0xb48e61);g.alpha=0;art.addChild(g);const splash=new Graphics();splash.alpha=0;art.addChild(splash);return{g,splash,start:.14+i*.023,x:w*(.17+(i%3)*.32),y:h*(.76-(i%3)*.045),dx:(random()-.5)*w*.19,hop:(35+random()*52)*u,life:.52+random()*.16}})
  function update(time){for(const p of grains){const age=time-p.start,v=Math.max(0,Math.min(1,age/p.life));p.g.alpha=age>=0&&age<p.life?1:0;p.g.scale.set(u);p.g.position.set(p.x+p.dx*v,p.y-Math.sin(Math.PI*v)*p.hop);p.g.rotation=v*4
    const q=(age-p.life)/.5;p.splash.clear();p.splash.alpha=q>=0&&q<1?(1-q)*.65:0;p.splash.position.set(p.x+p.dx,p.y)
    if(q>=0&&q<1){p.splash.ellipse(0,0,(7+q*10)*u,(2+q*1.4)*u).fill({color:0x987653,alpha:.38});for(let j=0;j<3;j++){const a=j*Math.PI*2/3+q;p.splash.circle(Math.cos(a)*(7+q*12)*u,Math.sin(a)*(2+q*3)*u,1.8*u).fill(0xc49d6c)}}}}
  onFrame(update);tl.call(()=>{update(.82);onCue({type:'impact'})},[],.82)
}
