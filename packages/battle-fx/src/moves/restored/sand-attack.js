import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sandAttack(context) {
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('sand-attack-root'),tip=make('sand-attack-tip'),impact=make('sand-attack-impact')
  const grains=Array.from({length:44},(_,i)=>({g:make(`sand-attack-grain-${i}`),start:.22+i%8*.016,lane:(random()-.5)*2,size:1.1+random()*1.7,phase:random()*6.28}))
  const dust=Array.from({length:12},(_,i)=>({g:make(`sand-attack-dust-${i}`),phase:i*Math.PI/6,start:.69+i*.027}))
  let struck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    root.clear();fit(root,a,29);root.alpha=time>=.035&&time<.61?Math.min(1,(time-.035)/.11,(.61-time)/.18):0
    for(let j=0;j<12;j++){const theta=j*2.4+time*5,r=5+(j%4)*4;root.circle(Math.cos(theta)*r,Math.sin(theta)*r*.65,1+j%3*.3).fill(j%2?0xe1cf9e:0xb39b69)}
    const u=clamp((time-.22)/.46),p={x:a.x+dx*u,y:a.y+dy*u};tip.clear();fit(tip,p,16);tip.rotation=angle
    tip.alpha=time>=.22&&time<.86?Math.min(1,.95+(time-.22),(.86-time)/.18):0
    tip.poly([0,0,-8,-6,-14,-2,-9,6,-4,3]).fill({color:0xd7bd87,alpha:.9}).circle(-4,-1,1.5).fill(0xf0dfb5)
    for(const grain of grains){
      const age=time-grain.start,u=clamp(age/.46),q={x:a.x+dx*u,y:a.y+dy*u},spread=Math.sin(u*Math.PI)*Math.min(55,room(q)*.62)*grain.lane
      const at={x:q.x+nx*spread,y:q.y+ny*spread-Math.sin(u*Math.PI)*Math.min(15,room(q)*.13)},g=grain.g,r=grain.size
      g.clear();fit(g,at,r*2);g.rotation=grain.phase+age*3;g.alpha=age>=0&&age<.61?Math.min(1,age/.04,(.61-age)/.15)*.88:0
      g.poly([-r,0,0,-r*.7,r,0,0,r*.9]).fill(grain.phase>3?0xc8ab72:0xe3cea0)
    }
    const age=time-.68;impact.clear();fit(impact,b,68);impact.alpha=struck&&age>=0&&age<.65?1-age/.65:0
    for(let j=0;j<7;j++){const theta=j*Math.PI*2/7,r=12+clamp(age/.4)*28;impact.ellipse(Math.cos(theta)*r,Math.sin(theta)*r*.61,15,10).fill({color:j%2?0xd8bd88:0xa78c61,alpha:.11})}
    for(const mote of dust){
      const age=time-mote.start,u=clamp(age/.86),r=Math.min(58,room(b)*.65),p={x:b.x+Math.cos(mote.phase)*r*u,y:b.y+Math.sin(mote.phase)*r*.27*u+r*.48*u*u},g=mote.g
      g.clear();fit(g,p,13);g.rotation=mote.phase+u;g.alpha=struck&&age>=0&&age<.86?Math.min(1,age/.08,(.86-age)/.32)*.58:0
      g.ellipse(0,0,5+u*5,3+u*4).fill({color:0xc7ab79,alpha:.16}).circle(-2,1,1.3).fill(0xdcc491).circle(3,-1,1).fill(0xa8895a)
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(.68);onCue({type:'impact'})},[],.68).to({},{duration:1.95},0)
}
