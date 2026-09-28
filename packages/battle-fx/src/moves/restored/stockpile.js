import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Separate amber packets spiral inward; three rings visually hold the charge.
export default function stockpile(context) {
  const {tl,onFrame,onCue,random}=context
  const {temporary,socket,unit}=bindEffectSpace(context)
  const art=new Container();art.label='stockpile-store';art.alpha=0;temporary.addChild(art)
  const rings=Array.from({length:3},(_,i)=>{const g=new Graphics().ellipse(0,0,29+i*11,12+i*6).stroke({color:i%2?0xf5e7bb:0xdcb976,width:2,alpha:.8});art.addChild(g);return g})
  const packets=Array.from({length:24},(_,i)=>{const g=new Graphics().poly([0,-4,5,0,0,4,-5,0]).fill(i%2?0xf5e6bd:0xdab676);g.label='stockpile-packet';art.addChild(g);return{g,a:i*Math.PI*2/24,delay:.12+random()*.25}})
  const core=new Graphics().circle(0,0,15).fill({color:0xf4dba6,alpha:.18}).circle(0,0,6).fill({color:0xffefc9,alpha:.5});art.addChild(core)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  function update(time){const p=socket('visualCenter',true),room=Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-3)
    art.position.copyFrom(p);art.scale.set(Math.min(1,room/101))
    packets.forEach(({g,a,delay})=>{const age=time-delay,u=Math.max(0,Math.min(1,age/.64)),angle=a+u*.85,r=86*(1-u)+8;g.position.set(Math.cos(angle)*r,Math.sin(angle)*r);g.rotation=angle;g.alpha=age>=0&&age<.64?Math.sin(Math.PI*u)*.85:0})
    rings.forEach((g,i)=>{g.y=(i-1)*17;g.scale.set(.65+Math.min(1,time/.94)*.35+Math.sin(time*4+i)*.045);g.rotation=Math.sin(time*2+i)*.06;g.alpha=.5+Math.sin(time*3+i)**2*.35})
    core.scale.set(.65+Math.min(1,time/.94)*.55+Math.sin(time*4)*.08)
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.24},.04).to(art,{alpha:0,duration:.45},1.68).call(()=>{update(.94);onCue({type:'impact'})},[],.94)
}
