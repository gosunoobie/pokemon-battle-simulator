import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function magnitude(context) {
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const groundFit=(g,p,rx,up,down)=>{g.position.copyFrom(p);g.scale.set(Math.max(0,Math.min(1,(p.x-left-4)/rx,(right-p.x-4)/rx,(p.y-top-4)/up,(bottom-p.y-4)/down)))}
  const root=make('magnitude-root'),fault=make('magnitude-fault'),tip=make('magnitude-tip'),impact=make('magnitude-impact'),rings=make('magnitude-ground-rings')
  const rocks=Array.from({length:25},(_,i)=>({g:make(`magnitude-rock-${i}`),phase:i*Math.PI*2/25,start:1.15+i%5*.045,r:3+random()*4,life:.81+random()*.13}))
  let struck=false
  function update(time){
    const a=socket('floor',true),b=targetSocket('floor',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    root.clear();groundFit(root,a,93,21,21);root.alpha=time>=.06&&time<.9?Math.min(1,(time-.06)/.2,(.9-time)/.3):0
    for(let j=0;j<3;j++){const q=(time*1.6+j/3)%1;root.ellipse(0,0,25+q*56,5+q*12).stroke({color:j%2?0xb19b76:0xd8c7a2,width:2.6-q,alpha:(1-q)*.72})}
    const u=clamp((time-.38)/.74),p={x:a.x+dx*u,y:a.y+dy*u};tip.clear();fit(tip,p,43);tip.rotation=angle
    tip.alpha=time>=.38&&time<1.35?Math.min(1,.95+u,(1.35-time)/.23):0
    tip.poly([0,0,-8,-7,-14,-3,-23,-9,-37,-1,-25,6,-15,1,-8,5]).fill(0x897350)
      .moveTo(0,0).lineTo(-14,-2).lineTo(-22,3).lineTo(-33,-1).stroke({color:0xdfcda4,width:1.4,alpha:.87})
    fault.clear();fault.alpha=time>=.38&&time<1.72?Math.min(1,(time-.38)/.1,(1.72-time)/.37):0
    for(let lane=0;lane<3;lane++){
      for(let j=0;j<=44;j++){const v=u*j/44,q={x:a.x+dx*v,y:a.y+dy*v},offset=(Math.sin(j*2.2+lane)*3+(lane-1)*4)*Math.min(1,room(q)/15)*Math.sin(j/44*Math.PI);const x=q.x+nx*offset,y=q.y+ny*offset;j?fault.lineTo(x,y):fault.moveTo(x,y)}
      fault.stroke({color:lane===1?0x746346:0xc0aa80,width:lane===1?2.7:1.1,alpha:lane===1?.74:.48})
    }
    const age=time-1.12,u2=clamp(age/.45);impact.clear();groundFit(impact,b,105,72,19);impact.alpha=struck&&age>=0&&age<1.08?1-clamp((age-.5)/.58):0
    for(let j=0;j<7;j++){
      const x=(j-3)*22,rise=Math.sin(u2*Math.PI*.8)*(25+j%3*13)
      impact.poly([x-11,3,x-8,-rise*.71,x+1,-rise,x+12,-rise*.6,x+15,4]).fill(j%2?0x8e7d5b:0xb3a17b)
        .moveTo(x+1,-rise).lineTo(x+4,-rise*.33).lineTo(x+14,4).stroke({color:0xe0d0aa,width:1.3,alpha:.77})
    }
    rings.clear();groundFit(rings,b,119,40,40);rings.alpha=struck&&age>=0&&time<2.42?Math.min(1,age/.13,(2.42-time)/.45)*.76:0
    for(let j=0;j<4;j++){const q=(Math.max(0,age)*.73+j/4)%1;rings.ellipse(0,0,28+q*83,8+q*25).stroke({color:j%2?0xd3c19a:0xa69370,width:2.1-q,alpha:(1-q)*.59})}
    for(const rock of rocks){
      const age=time-rock.start,u=clamp(age/rock.life),dx=Math.cos(rock.phase)*Math.min(68,b.x-left-13,right-b.x-13),up=Math.min(55,b.y-top-16),fall=Math.min(22,bottom-b.y-12)
      const p={x:b.x+dx*u,y:b.y-up*Math.sin(u*Math.PI)+fall*u*u},g=rock.g,r=rock.r
      g.clear();fit(g,p,r*2);g.rotation=rock.phase+u*2;g.alpha=struck&&age>=0&&age<rock.life?Math.min(1,age/.05,(rock.life-age)/.26)*.86:0
      g.poly([-r,-r*.5,-r*.3,-r,r*.8,-r*.35,r,r*.6,-r*.4,r]).fill(0xa18f6b).moveTo(-r*.3,-r).lineTo(r*.3,0).lineTo(r,r*.6).stroke({color:0xd6c39d,width:1,alpha:.74})
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(1.12);onCue({type:'impact'})},[],1.12).to({},{duration:2.55},0)
}
