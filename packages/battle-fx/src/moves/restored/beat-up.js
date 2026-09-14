import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function beatUp(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('beat-up-root')
  const hits=Array.from({length:4},(_,i)=>({g:make(i===3?'beat-up-tip':`beat-up-ally-strike-${i}`),trail:make(`beat-up-strike-trail-${i}`),impact:make(i===3?'beat-up-impact':`beat-up-cosmetic-impact-${i}`),start:[.22,.44,.66,.94][i],contact:[.62,.84,1.06,1.26][i],lane:[-1.1,.8,-.5,0][i],color:[0x8d9bad,0xa096ba,0x7e9caa,0xb5afcd][i]}))
  const chips=Array.from({length:21},(_,i)=>({g:make(`beat-up-chip-${i}`),angle:i*Math.PI*2/21,start:1.29+i%3*.07,life:.67+random()*.16,size:2+random()*3}))
  let struck=false
  function update(time){
    const a=socket('hand',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length
    root.clear();fit(root,a,38);root.alpha=time>=.055&&time<1.36?Math.min(1,(time-.055)/.14,(1.36-time)/.2):0
    for(let j=0;j<3;j++){
      const theta=j*Math.PI*2/3+time*.9,r=17+Math.sin(time*7+j)*3,x=Math.cos(theta)*r,y=Math.sin(theta)*r
      root.poly([x-6,y-3,x-2,y-7,x+6,y-3,x+7,y+3,x-2,y+6,x-7,y+1]).stroke({color:hits[j].color,width:1.4,alpha:.68})
    }
    for(let i=0;i<hits.length;i++){
      const hit=hits[i],age=time-hit.start,u=clamp(age/(hit.contact-hit.start)),route=v=>{
        const p={x:a.x+dx*v,y:a.y+dy*v},bow=Math.sin(v*Math.PI)*Math.min(55,length*.17,room(p)*.56)*hit.lane
        return{x:p.x+nx*bow,y:p.y+ny*bow}
      },p=route(u),q=route(Math.min(1,u+.003)),z=route(Math.max(0,u-.003)),angle=Math.atan2(q.y-z.y,q.x-z.x),g=hit.g
      g.clear();fit(g,p,i===3?62:51);g.rotation=angle
      g.alpha=time>=hit.start&&time<hit.contact+.18?Math.min(1,.93+age,(hit.contact+.18-time)/.18):0
      // Distinct abstract ally marks suggest a group without importing or inventing party actors.
      if(i===0){
        g.poly([0,0,-8,-13,-16,-8,-20,-15,-25,-7,-35,-8,-39,4,-27,11,-13,12]).fill({color:hit.color,alpha:.81})
        for(let k=0;k<3;k++)g.moveTo(-8-k*9,-8).lineTo(-12-k*8,5).stroke({color:0xd0dce7,width:1.2,alpha:.75})
      }else if(i===1){
        g.poly([0,0,-13,-8,-22,-23,-37,-20,-31,-3,-38,8,-22,13,-6,10]).fill({color:hit.color,alpha:.84})
        g.moveTo(-30,-14).lineTo(-20,3).lineTo(-7,5).stroke({color:0xe0d3eb,width:1.5,alpha:.7})
      }else if(i===2){
        for(let k=0;k<3;k++)g.poly([0,0,-31,-15+k*12,-38,-10+k*12,-12,5]).fill({color:hit.color,alpha:.66})
        g.moveTo(-29,-11).lineTo(-2,0).moveTo(-32,9).lineTo(-2,0).stroke({color:0xc7e2e5,width:1.5,alpha:.78})
      }else{
        g.poly([0,0,-5,-17,-14,-23,-24,-21,-27,-14,-36,-18,-49,-9,-47,11,-28,22,-9,16]).fill({color:0x625d7e,alpha:.92})
          .poly([0,0,-8,-14,-23,-15,-29,-6,-23,9,-6,11]).fill(hit.color)
        for(let k=0;k<3;k++)g.moveTo(-10-k*7,-12).lineTo(-11-k*7,2).stroke({color:0xeee2f4,width:1.4,alpha:.83})
      }
      hit.trail.clear();hit.trail.alpha=g.alpha*.51
      for(let k=1;k<7;k++){
        const p=route(Math.max(0,u-k*.027)),q=route(Math.max(0,u-k*.027-.023))
        hit.trail.moveTo(p.x,p.y).lineTo(q.x,q.y).stroke({color:hit.color,width:4-k*.46,alpha:1-k/8,cap:'round'})
      }
      const since=time-hit.contact,v=clamp(since/.37),impact=hit.impact
      impact.clear();fit(impact,b,i===3?86:60);impact.alpha=since>=0&&since<.37?(1-v)*(i===3?1:.74):0
      const r=(i===3?42:24)*(1+v*.44)
      impact.poly([-r,0,-r*.24,-r*.2,0,-r*.7,r*.17,-r*.18,r,0,r*.2,r*.17,0,r*.7,-r*.24,r*.17]).fill({color:hit.color,alpha:.65})
        .moveTo(-r*.65,r*.2).lineTo(r*.59,-r*.2).stroke({color:0xe4e4f1,width:i===3?2.8:1.7,alpha:.94})
    }
    for(const chip of chips){
      const age=time-chip.start,u=clamp(age/chip.life),reach=Math.min(59,room(b)*.6),vx=Math.cos(chip.angle)*reach,vy=Math.sin(chip.angle)*reach*.36
      const p={x:b.x+vx*u,y:b.y+vy*u+reach*.72*u*u},g=chip.g,r=chip.size
      g.clear();fit(g,p,r*2);g.rotation=chip.angle+u*2;g.alpha=struck&&age>=0&&age<chip.life?Math.min(1,age/.05,(chip.life-age)/.25)*.83:0
      g.poly([-r,0,0,-r*.7,r,0,0,r*.7]).fill(chip.angle<Math.PI?0xb8a9ca:0x8ba9b9)
    }
  }
  onFrame(update)
  tl.call(()=>{struck=true;update(1.26);onCue({type:'impact'})},[],1.26).to({},{duration:2.35},0)
}
