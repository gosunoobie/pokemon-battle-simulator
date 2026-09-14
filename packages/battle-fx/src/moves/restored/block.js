import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function block(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('block-root'),tip=make('block-tip'),impact=make('block-impact'),locks=make('block-corner-locks')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const chips=Array.from({length:18},(_,i)=>({g:make(`block-chip-${i}`),phase:i*Math.PI/9,start:.92+i*.017,size:2.4+random()*3.4}))
  let blocked=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.38)/.54),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,37);root.alpha=time>.07&&time<1.14?clamp((time-.07)/.17)*(1-clamp((time-.72)/.42)):0
    const inset=17-clamp(time/.38)*7
    for(const side of[-1,1])root.moveTo(side*inset,-18).lineTo(side*24,-18).lineTo(side*24,18).lineTo(side*inset,18).stroke({color:0xcabdaf,width:4,alpha:.75})
    tip.clear();fit(tip,p,47);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.38&&time<1.22?1-clamp((time-.98)/.24):0
    tip.poly([0,0,-11,-16,-31,-16,-39,0,-30,16,-11,16]).fill({color:0xb8aea0,alpha:.82})
      .poly([-7,0,-15,-8,-27,-8,-32,0,-27,8,-15,8]).fill({color:0xe0d6c3,alpha:.83})
      .moveTo(-31,-16).lineTo(-27,-8).moveTo(-30,16).lineTo(-27,8).stroke({color:0x8f847a,width:1.4,alpha:.84})
    const age=time-.92,rise=clamp(age/.26),settle=1+Math.sin(clamp(age/.38)*Math.PI)*.06,fade=1-clamp((age-.67)/.43)
    impact.clear();fit(impact,b,108);impact.alpha=blocked&&age>=0&&age<1.1?fade:0
    // Solid gateposts and a lintel leave the central actor fully readable through the opening.
    const h=25+rise*41
    for(const side of[-1,1]){
      const x=side*65*settle
      impact.poly([x-9,-h,x+9,-h,x+13,57,x-13,57]).fill({color:side>0?0x9d958d:0xb7aba0,alpha:.86})
        .poly([x-9,-h,x-3,-h,x-1,56,x-13,56]).fill({color:0xd5c9b7,alpha:.7})
        .moveTo(x-9,-h+20).lineTo(x+9,-h+20).moveTo(x-10,13).lineTo(x+10,13).stroke({color:0x817971,width:1.5,alpha:.8})
    }
    impact.poly([-77,-h,-64,-h-12,64,-h-12,77,-h,74,-h+7,-74,-h+7]).fill({color:0xb6aa98,alpha:.86})
      .moveTo(-64,-h-10).lineTo(64,-h-10).stroke({color:0xe3d6bf,width:2,alpha:.78})
    locks.clear();fit(locks,b,62);locks.alpha=blocked&&age>=0&&age<.76?1-clamp((age-.28)/.48):0
    for(const side of[-1,1])locks.moveTo(side*32,-22).lineTo(side*22,-22).lineTo(side*22,22).lineTo(side*32,22)
      .stroke({color:0xf2dfae,width:2.3,alpha:.69})
    chips.forEach(f=>{const age=time-f.start,v=clamp(age/1.07),r=Math.min(96,room(b)*.76),at={x:b.x+Math.cos(f.phase)*r*(.44+v*.35),y:b.y+Math.sin(f.phase)*r*.34+r*(-.06*v+.43*v*v)},g=f.g
      g.clear();fit(g,at,15);g.rotation=f.phase+v*1.8;g.alpha=blocked&&age>=0&&age<1.07?clamp(age/.1)*(1-clamp((v-.53)/.47))*.76:0
      const s=f.size;g.poly([-s,-s*.6,s*.5,-s,s,s*.7,-s*.4,s]).fill({color:f.phase>3?0xb6a999:0xd3c5b0,alpha:.82})})
  }
  onFrame(update)
  tl.call(()=>update(.38),[],.38).call(()=>{blocked=true;update(.92);onCue({type:'impact'})},[],.92).to({}, {duration:2.15},0)
}
