import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A resistance dial folds its angular panels into a changing shield.
export default function conversion2(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const art=new Container();art.label='conversion-2-dial';art.alpha=0;temporary.addChild(art)
  const dial=new Graphics().circle(0,0,77).stroke({color:0xa7e7ed,width:1.4,alpha:.55})
  for(let i=0;i<16;i++){const a=i*Math.PI/8;dial.moveTo(Math.cos(a)*71,Math.sin(a)*71).lineTo(Math.cos(a)*77,Math.sin(a)*77).stroke({color:0xccefff,width:1.3,alpha:.75})}art.addChild(dial)
  const panels=Array.from({length:6},(_,i)=>{const g=new Graphics().poly([0,-26,15,0,0,26,-15,0]).fill({color:i%2?0xa5c8e9:0xbce9df,alpha:.17}).stroke({color:0xdcfaff,width:1.5,alpha:.85});g.label='conversion-2-panel';art.addChild(g);return g})
  const core=new Graphics().poly([0,-12,12,0,0,12,-12,0]).fill({color:0xe3fcff,alpha:.18}).stroke({color:0xdbf5ff,width:2});art.addChild(core)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  function update(time){const p=socket('visualCenter',true),room=Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-3)
    art.position.copyFrom(p);art.scale.set(Math.min(1,room/103));dial.rotation=-time*.36
    panels.forEach((g,i)=>{const u=Math.max(0,Math.min(1,(time-.12-i*.04)/.55)),a=i*Math.PI/3+time*.3,r=64-u*18+Math.sin(time*3+i)*3;g.position.set(Math.cos(a)*r,Math.sin(a)*r);g.rotation=a+Math.PI/2;g.scale.set(.65+u*.35);g.alpha=u*(.55+Math.sin(time*2+i)**2*.4)})
    core.rotation=time*.65;core.scale.set(.7+Math.sin(time*3)**2*.35)
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.3},.04).to(art,{alpha:0,duration:.48},1.65).call(()=>{update(.92);onCue({type:'impact'})},[],.92)
}
