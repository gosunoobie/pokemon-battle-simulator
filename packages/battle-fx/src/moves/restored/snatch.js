import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A hooked silhouette curls around a bright lure without touching either actor.
export default function snatch(context) {
  const {tl,onFrame,onCue}=context
  const {temporary,socket,unit}=bindEffectSpace(context)
  const art=new Container();art.label='snatch-hook';art.alpha=0;temporary.addChild(art)
  const hand=new Graphics().moveTo(-22,14).lineTo(-13,-5).quadraticCurveTo(-11,-30,-5,-28).lineTo(-3,-10)
    .quadraticCurveTo(2,-36,8,-30).lineTo(9,-8).quadraticCurveTo(17,-29,22,-21).lineTo(18,2)
    .quadraticCurveTo(32,-12,34,-4).lineTo(22,18).quadraticCurveTo(8,34,-13,25).closePath()
    .fill({color:0x756191,alpha:.65}).stroke({color:0xd2b6ed,width:1.5,alpha:.8});hand.label='snatch-hand';art.addChild(hand)
  const curl=new Graphics();art.addChild(curl)
  const glint=new Graphics().poly([0,-8,2,-2,8,0,2,2,0,8,-2,2,-8,0,-2,-2]).fill(0xf6e4ba);art.addChild(glint)
  const motes=Array.from({length:9},()=>{const g=new Graphics().circle(0,0,2).fill(0xc9ade3);art.addChild(g);return g})
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  function update(time){const p=socket('visualCenter',true),room=Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-3)
    art.position.copyFrom(p);art.scale.set(Math.min(1,room/112))
    const u=Math.max(0,Math.min(1,(time-.13)/.65)),angle=-2.2+u*1.8
    hand.position.set(Math.cos(angle)*44,Math.sin(angle)*44);hand.rotation=angle+Math.PI*.7;hand.scale.set(1-u*.13)
    curl.clear();for(let j=0;j<=30;j++){const a=angle-.8+j/30*1.6,r=66-j*.5,x=Math.cos(a)*r,y=Math.sin(a)*r;j?curl.lineTo(x,y):curl.moveTo(x,y)}curl.stroke({color:0xb79bd7,width:2.5,alpha:.45})
    glint.position.set(42*(1-u),-12);glint.rotation=time*1.7;glint.scale.set(.8+Math.sin(time*5)**2*.2);glint.alpha=time<1.22?1:Math.max(0,1-(time-1.22)/.4)
    motes.forEach((g,i)=>{const a=time*1.35+i*.65;g.position.set(Math.cos(a)*(68-i*3),Math.sin(a)*(68-i*3));g.alpha=.15+Math.sin(time*3+i)**2*.4})
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.24},.04).to(art,{alpha:0,duration:.48},1.5).call(()=>{update(.78);onCue({type:'impact'})},[],.78)
}
