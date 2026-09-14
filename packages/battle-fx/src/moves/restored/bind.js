import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bind(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('bind-root'),trail=make('bind-trailing-cords'),tip=make('bind-tip'),impact=make('bind-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const fibers=Array.from({length:16},(_,i)=>({g:make(`bind-fiber-${i}`),phase:random()*6.28,start:.82+i*.014,size:3+random()*4}))
  let bound=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.32)/.5),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,27);root.alpha=time>.08&&time<1.12?clamp((time-.08)/.14)*(1-clamp((time-.72)/.4)):0
    root.moveTo(-12,-9).quadraticCurveTo(16,-15,13,0).quadraticCurveTo(11,13,-10,8).stroke({color:0xc8a078,width:4,alpha:.78})
    trail.clear();trail.alpha=time>=.32&&time<1.15?1-clamp((time-.84)/.31):0
    for(const side of[-1,1]){
      const points=[]
      for(let j=0;j<=42;j++){const v=u*j/42,q={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v};q.y+=side*Math.sin(j/42*Math.PI)*Math.sin(v*11-time*5)*Math.min(27,room(q)*.4);points.push(q)}
      for(const[width,color]of[[5,0x795b42],[2.8,0xc6a17c]]){points.forEach((q,j)=>j?trail.lineTo(q.x,q.y):trail.moveTo(q.x,q.y));trail.stroke({width,color,alpha:.85,cap:'round'})}
    }
    tip.clear();fit(tip,p,23);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.32&&time<1.1?1-clamp((time-.86)/.24):0
    tip.moveTo(0,0).quadraticCurveTo(-6,-12,-16,-7).quadraticCurveTo(-23,3,-10,8).quadraticCurveTo(-1,11,0,0)
      .stroke({color:0x916b49,width:4.8,alpha:.95}).moveTo(0,0).quadraticCurveTo(-7,-10,-15,-5).stroke({color:0xe3c197,width:1.5,alpha:.95})
    const age=time-.82,squeeze=.88-Math.sin(clamp(age/.88)*Math.PI)*.16
    impact.clear();fit(impact,b,98);impact.alpha=bound&&age>=0&&age<1.08?1-clamp((age-.58)/.5):0
    // Two narrow crossing cords cinch in a figure eight, then slacken and drift apart.
    for(const side of[-1,1])for(const[width,color]of[[5.6,0x735440],[3.2,0xc19a72],[.9,0xe9cba0]]){
      for(let j=0;j<=72;j++){const q=j/72*Math.PI*2,x=Math.sin(q)*73*squeeze,y=Math.sin(q*2)*34+side*8+clamp((age-.61)/.47)*Math.sin(q)*14;if(j===0)impact.moveTo(x,y);else impact.lineTo(x,y)}
      impact.stroke({width,color,alpha:.83,cap:'round'})
    }
    fibers.forEach(f=>{const age=time-f.start,v=clamp(age/1.06),r=Math.min(85,room(b)*.75),q=f.phase+v*.55,at={x:b.x+Math.cos(q)*r*(.38+v*.4),y:b.y+Math.sin(f.phase)*r*.3+r*v*v*.35},g=f.g
      g.clear();fit(g,at,17);g.rotation=q;g.alpha=bound&&age>=0&&age<1.06?clamp(age/.14)*(1-clamp((v-.55)/.45))*.73:0
      g.moveTo(-f.size,0).quadraticCurveTo(0,-f.size*.6,f.size,f.size*.3).stroke({color:0xd3b18b,width:1.3,alpha:.8})})
  }
  onFrame(update)
  tl.call(()=>update(.32),[],.32).call(()=>{bound=true;update(.82);onCue({type:'impact'})},[],.82).to({}, {duration:2.1},0)
}
