import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Translucent mottled patches change their arrangement around a fixed silhouette.
export default function camouflage(context) {
  const {tl,onFrame,onCue,random}=context
  const {temporary,socket,unit}=bindEffectSpace(context)
  const art=new Container();art.label='camouflage-pattern';art.alpha=0;temporary.addChild(art)
  const colors=[0xa3c69e,0x83b3b8,0xb7c28d,0xc8d9b5]
  const patches=Array.from({length:14},(_,i)=>{const g=new Graphics().moveTo(-12,-4).bezierCurveTo(-14,-17,6,-17,9,-7).bezierCurveTo(26,-2,15,14,3,11).bezierCurveTo(-8,21,-22,8,-12,-4).closePath().fill({color:colors[i%4],alpha:.21}).stroke({color:colors[(i+1)%4],width:1.2,alpha:.45});g.label='camouflage-patch';art.addChild(g);return{g,a:i*2.4,r:20+random()*40,phase:random()*6.28}})
  const contour=new Graphics();art.addChild(contour)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  function update(time){const p=socket('visualCenter',true),room=Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-3)
    art.position.copyFrom(p);art.scale.set(Math.min(1,room/110))
    patches.forEach(({g,a,r,phase},i)=>{const angle=a+time*.2;g.position.set(Math.cos(angle)*r+Math.sin(time*2+phase)*3,Math.sin(angle)*r*1.15);g.rotation=Math.sin(time+phase)*.35;g.scale.set(.72+Math.sin(time*1.5+phase)**2*.22);g.alpha=.35+Math.sin(time*2+i*.6)**2*.6})
    contour.clear();for(let j=0;j<=64;j++){const a=j/64*Math.PI*2,r=73+Math.sin(a*5+time*2)*3,x=Math.cos(a)*r*.85,y=Math.sin(a)*r;j?contour.lineTo(x,y):contour.moveTo(x,y)}contour.stroke({color:0xdaeacc,width:1.4,alpha:.52})
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.46},.04).to(art,{alpha:0,duration:.55},1.69).call(()=>{update(.94);onCue({type:'impact'})},[],.94)
}
