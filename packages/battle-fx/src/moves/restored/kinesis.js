import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function kinesis(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('kinesis-root'),tip=make('kinesis-tip'),impact=make('kinesis-impact')
  root.attachmentSocket=attachment;tip.contactPoint={x:0,y:0}
  const warps=Array.from({length:6},(_,i)=>({g:make(`kinesis-warp-${i}`),start:.53+i*.038}))
  const glints=Array.from({length:20},(_,i)=>({g:make(`kinesis-glint-${i}`),phase:random()*6.28,start:1.06+i*.018,size:2+random()*2.3}))
  let bent=false
  function update(time){
    const a=socket(attachment,true),b=targetSocket('center',true),u=clamp((time-.5)/.56),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,62);root.alpha=time>.06&&time<1.27?clamp((time-.06)/.18)*(1-clamp((time-.89)/.38)):0
    const curve=clamp((time-.2)/.38)*18
    // A metal spoon visibly bends at the neck before the psychic distortion leaves it.
    root.moveTo(-4,34).quadraticCurveTo(0,17,curve,5).quadraticCurveTo(curve+9,-2,curve,-15)
      .stroke({color:0x8f91ad,width:6,alpha:.91,cap:'round'})
      .moveTo(-5,33).quadraticCurveTo(-1,16,curve-1,4).quadraticCurveTo(curve+7,-2,curve-1,-14)
      .stroke({color:0xeee6ed,width:2.2,alpha:.91,cap:'round'})
      .ellipse(curve,-25,10,15).fill({color:0xb5b4cb,alpha:.85}).stroke({color:0xe2d9ed,width:1.4,alpha:.91})
      .ellipse(curve-2,-27,5,9).fill({color:0xe9e4f1,alpha:.58})
    for(let i=0;i<2;i++)root.ellipse(curve,-4,26+i*7,8+i*3).stroke({color:i?0xc3a6d8:0xe3c5ec,width:1.2,alpha:.48})
    tip.clear();fit(tip,p,49);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.5&&time<1.37?1-clamp((time-1.12)/.25):0
    tip.moveTo(0,0).quadraticCurveTo(-18,-20,-34,-6).quadraticCurveTo(-10,-4,-20,14).quadraticCurveTo(-3,16,0,0)
      .fill({color:0xdcc5ed,alpha:.62}).stroke({color:0xf1dff7,width:1.4,alpha:.86})
      .moveTo(-29,-3).quadraticCurveTo(-8,-9,-7,4).stroke({color:0xc3a3da,width:2,alpha:.75})
    warps.forEach(f=>{const age=time-f.start,v=clamp(age/.62),at={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v},g=f.g
      g.clear();fit(g,at,25);g.rotation=Math.atan2(b.y-a.y,b.x-a.x);g.alpha=age>=0&&age<.94?clamp(age/.1)*(1-clamp((age-.52)/.42))*.56:0
      g.moveTo(-8,-16).quadraticCurveTo(13,-7,3,0).quadraticCurveTo(-6,9,9,16).stroke({color:0xd3bae4,width:2,alpha:.77,cap:'round'})})
    const age=time-1.06,v=clamp(age/1.08)
    impact.clear();fit(impact,b,91);impact.alpha=bent&&age>=0&&age<1.08?1-clamp((age-.47)/.61):0
    for(const side of[-1,1]){
      const bend=Math.sin(time*6+side)*14
      impact.moveTo(side*61,-32).quadraticCurveTo(side*22,-41,side*34,-8).quadraticCurveTo(side*54,bend,side*22,37)
        .stroke({color:side>0?0xe5cfeb:0xbaacd9,width:2.8-v,alpha:.74,cap:'round'})
      impact.moveTo(side*25,-52).quadraticCurveTo(side*8,-35,side*17,-17).stroke({color:0xf0deef,width:1.5,alpha:.6})
    }
    impact.ellipse(0,0,14+v*16,9+Math.sin(time*5)*3).stroke({color:0xdfc5ef,width:1.8,alpha:.6})
    glints.forEach(f=>{const age=time-f.start,v=clamp(age/1.09),r=Math.min(97,room(b)*.75),q=f.phase+v*1.8,at={x:b.x+Math.cos(q)*r*(.34+v*.42),y:b.y+Math.sin(q)*r*.32-r*v*.18},g=f.g
      g.clear();fit(g,at,15);g.rotation=q;g.alpha=bent&&age>=0&&age<1.09?clamp(age/.14)*(1-clamp((v-.57)/.43))*.8:0
      const s=f.size;g.poly([0,-s*2,s*.5,-s*.3,s*2,0,s*.5,s*.3,0,s*2,-s*.5,s*.3,-s*2,0,-s*.5,-s*.3]).fill({color:f.phase>3?0xe0d1ed:0xf2dfee,alpha:.8})})
  }
  onFrame(update)
  tl.call(()=>update(.5),[],.5).call(()=>{bent=true;update(1.06);onCue({type:'impact'})},[],1.06).to({}, {duration:2.3},0)
}
