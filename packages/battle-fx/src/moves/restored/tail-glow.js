import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function tailGlow(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('tail') ? 'tail' : context.source.hasAnchor?.('body') ? 'body' : 'center'
  const edges = [-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const root=new Container();root.label='tail-glow-root';root.attachmentSocket=attachment;temporary.addChild(root)
  const halo=new Graphics();halo.label='tail-glow-halo';root.addChild(halo)
  const impact=new Graphics();impact.label='tail-glow-impact';root.addChild(impact)
  const tip=new Graphics();tip.label='tail-glow-tip';root.addChild(tip)
  const fireflies=Array.from({length:26},(_,i)=>{
    const g=new Graphics();g.label=`tail-glow-firefly-${i}`;g.alpha=0;temporary.addChild(g)
    return{g,start:.42+i*.032,phase:random()*Math.PI*2,reach:15+random()*26,rise:42+random()*43,life:.72+random()*.18,size:2.2+random()*2.4}
  })
  let lit=false
  function update(time){
    const a=socket(attachment,true),charge=clamp((time-.06)/.86),fade=clamp((time-1.82)/.35)
    root.position.copyFrom(a);root.scale.set(Math.min(1,room(a)/73))
    root.alpha=time>=.06&&time<2.17?Math.min(1,(time-.06)/.16)*(1-fade):0
    halo.clear();impact.clear();tip.clear()
    const breathe=.93+Math.sin(time*4.2)*.07
    for(let j=8;j>=0;j--){
      const r=(17+j*5)*(.4+charge*.6)*breathe
      halo.circle(0,0,r).fill({color:j%2?0xcce76b:0xf8de83,alpha:.008+(8-j)*.0015})
    }
    // The lantern is an organic luminous pod attached to the actual tail/body socket.
    impact.moveTo(0,-18).quadraticCurveTo(15,-12,14,1).quadraticCurveTo(11,13,0,17)
      .quadraticCurveTo(-12,11,-14,0).quadraticCurveTo(-15,-13,0,-18).fill({color:0xcce875,alpha:.54+charge*.25})
      .moveTo(0,-16).quadraticCurveTo(7,-5,6,6).quadraticCurveTo(3,11,0,15)
      .quadraticCurveTo(-6,8,-6,-1).quadraticCurveTo(-5,-9,0,-16).fill({color:0xfff0a5,alpha:.87})
    impact.alpha=.76+charge*.24
    tip.circle(0,0,5+charge*3).fill({color:0xfff9c6,alpha:.84})
    const age=time-.92
    if(lit&&age>=0)for(let j=0;j<3;j++){
      const u=clamp((age-j*.12)/.69),r=21+u*38
      if(age<j*.12||u>=1)continue
      halo.ellipse(0,0,r,r*(.76+Math.sin(time*2+j)*.06)).stroke({color:j%2?0xe4ee9a:0xf8e5a5,width:1.3,alpha:(1-u)*.6})
    }
    for(const fly of fireflies){
      const age=time-fly.start,u=clamp(age/fly.life),clearance=room(a)
      const x=Math.sin(fly.phase+u*3.3)*Math.min(fly.reach,clearance*.39)*Math.sin(u*Math.PI*.68)
      const p={x:a.x+x,y:a.y-Math.min(fly.rise,clearance*.75)*u}
      const g=fly.g,r=fly.size;g.clear();g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/(r*3.6)))
      const blink=.68+.32*Math.sin(age*9+fly.phase)
      g.alpha=age>=0&&age<fly.life?Math.min(1,age/.12,(fly.life-age)/.25)*blink*.86:0
      const wing=Math.sin(age*35+fly.phase)*1.6
      g.ellipse(-r*.87,-1-wing,r*.9,r*.37).fill({color:0xd5edaa,alpha:.35})
        .ellipse(r*.87,-1+wing,r*.9,r*.37).fill({color:0xd5edaa,alpha:.35})
        .circle(0,0,r*1.6).fill({color:0xf0df84,alpha:.08})
        .circle(0,0,r*.66).fill(0xf8ed9f).circle(0,-.4,r*.29).fill(0xffffd1)
    }
  }
  onFrame(update)
  tl.call(()=>{lit=true;update(.92);onCue({type:'impact'})},[],.92).call(()=>{},[],2.3)
}
