import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mudSlap(context) {
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('mud-slap-root'),tip=make('mud-slap-tip'),smear=make('mud-slap-swing'),impact=make('mud-slap-impact')
  const drops=Array.from({length:18},(_,i)=>({g:make(`mud-slap-drop-${i}`),phase:i*Math.PI/9,start:.65+i%3*.05,r:2+random()*2,life:.74+random()*.12}))
  let struck=false
  function update(time){
    const a=socket('hand',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx)
    root.clear();fit(root,a,29);root.rotation=angle;root.alpha=time>=.04&&time<.54?Math.min(1,(time-.04)/.12,(.54-time)/.18):0
    root.moveTo(-14,7).quadraticCurveTo(-18,-8,-5,-11).quadraticCurveTo(9,-17,16,-1).quadraticCurveTo(20,10,1,11).closePath().fill(0x8b704d)
      .moveTo(-8,-5).quadraticCurveTo(2,-12,11,-2).stroke({color:0xb99c6c,width:2,alpha:.77})
    const u=clamp((time-.28)/.36),p={x:a.x+dx*u,y:a.y+dy*u-Math.sin(u*Math.PI)*Math.min(25,room({x:a.x+dx*u,y:a.y+dy*u})*.24)}
    tip.clear();fit(tip,p,49);tip.rotation=angle;tip.alpha=time>=.28&&time<.89?Math.min(1,.95+u,(.89-time)/.25):0
    tip.moveTo(0,0).quadraticCurveTo(-7,-17,-18,-18).quadraticCurveTo(-21,-27,-32,-15).quadraticCurveTo(-48,-12,-38,1)
      .quadraticCurveTo(-45,19,-23,17).quadraticCurveTo(-9,22,0,0).fill(0x8c704a)
      .moveTo(-5,-2).quadraticCurveTo(-17,-17,-30,-9).stroke({color:0xc5aa7c,width:3,alpha:.81})
    smear.clear();smear.alpha=tip.alpha*.47
    const tail=Math.max(0,u-.25),q={x:a.x+dx*tail,y:a.y+dy*tail},bow=Math.min(17,room(q)*.3)
    smear.moveTo(q.x,q.y).quadraticCurveTo((q.x+p.x)/2,(q.y+p.y)/2-bow,p.x,p.y).stroke({color:0xa48b60,width:4,alpha:.47,cap:'round'})
    const age=time-.64,u2=clamp(age/.68);impact.clear();fit(impact,b,71);impact.alpha=struck&&age>=0&&age<.92?1-clamp((age-.31)/.61):0
    for(let j=0;j<7;j++){
      const theta=j*Math.PI*2/7,r=13+u2*10,x=Math.cos(theta)*r,y=Math.sin(theta)*r*.76
      impact.ellipse(x,y,17-j%3*2,13+j%2*2).fill({color:j%2?0x87694b:0xa1875a,alpha:.43})
    }
    impact.moveTo(-15,-11).quadraticCurveTo(0,-25,16,-9).stroke({color:0xc0a273,width:2.3,alpha:.65})
    for(const drop of drops){
      const age=time-drop.start,u=clamp(age/drop.life),d=Math.min(49,room(b)*.51),p={x:b.x+Math.cos(drop.phase)*d*u,y:b.y+Math.sin(drop.phase)*d*.32*u+d*.91*u*u},g=drop.g,r=drop.r
      g.clear();fit(g,p,r*2);g.rotation=drop.phase+u;g.alpha=struck&&age>=0&&age<drop.life?Math.min(1,age/.045,(drop.life-age)/.24)*.87:0
      g.ellipse(0,0,r,r*1.35).fill(0x91724d).ellipse(-r*.23,-r*.34,r*.38,r*.51).fill(0xb69a6e)
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(.64);onCue({type:'impact'})},[],.64).to({},{duration:1.85},0)
}
