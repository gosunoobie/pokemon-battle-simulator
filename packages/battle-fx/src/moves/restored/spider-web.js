import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function spiderWeb(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('spider-web-root'),thread=make('spider-web-cast-thread'),tip=make('spider-web-tip'),impact=make('spider-web-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const dew=Array.from({length:20},(_,i)=>({g:make(`spider-web-dew-${i}`),phase:random()*6.28,start:.94+i*.02,size:1.4+random()*1.8}))
  let caught=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.32)/.62),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,27);root.alpha=time>.04&&time<1.12?clamp((time-.04)/.17)*(1-clamp((time-.69)/.43)):0
    for(let i=0;i<6;i++){const q=i*Math.PI/3;root.moveTo(0,0).lineTo(Math.cos(q)*18,Math.sin(q)*18).stroke({color:0xd9dde7,width:1.3,alpha:.62})}
    thread.clear();thread.alpha=time>=.32&&time<1.17?1-clamp((time-.91)/.26):0
    for(let j=0;j<=45;j++){const v=u*j/45,q={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v};q.y+=Math.sin(j/45*Math.PI)*Math.min(15,room(q)*.25)*Math.sin(time*4);j?thread.lineTo(q.x,q.y):thread.moveTo(q.x,q.y)}
    thread.stroke({color:0xe6e5ed,width:1.7,alpha:.82})
    tip.clear();fit(tip,p,37);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.32&&time<1.24?1-clamp((time-.98)/.26):0
    tip.poly([0,0,-11,-10,-25,-7,-31,0,-24,8,-10,11]).stroke({color:0xe7e8f1,width:2.2,alpha:.93})
      .moveTo(0,0).lineTo(-25,-7).moveTo(0,0).lineTo(-24,8).moveTo(-11,-10).lineTo(-10,11).stroke({color:0xbfc7da,width:1.1,alpha:.84})
    const age=time-.94,grow=.36+clamp(age/.39)*.64,sway=Math.sin(age*5)*1.7
    impact.clear();fit(impact,b,103);impact.alpha=caught&&age>=0&&age<1.3?1-clamp((age-.76)/.54):0
    // Eight radial spokes and bowed cross threads weave outward in successive rings.
    for(let i=0;i<8;i++){const q=i*Math.PI/4;impact.moveTo(0,0).lineTo(Math.cos(q)*86*grow,Math.sin(q)*76*grow).stroke({color:0xdce1ee,width:1.4,alpha:.83})}
    for(let ring=1;ring<=4;ring++){
      const r=ring*19*grow
      for(let i=0;i<8;i++){const q=i*Math.PI/4,n=q+Math.PI/4;impact.moveTo(Math.cos(q)*r,Math.sin(q)*r*.88)
        .quadraticCurveTo(Math.cos(q+Math.PI/8)*r*.69,Math.sin(q+Math.PI/8)*r*.61+sway,Math.cos(n)*r,Math.sin(n)*r*.88).stroke({color:ring%2?0xe4e7f2:0xb9c5d9,width:1.2,alpha:.72})}
    }
    dew.forEach(f=>{const age=time-f.start,v=clamp(age/1.23),r=Math.min(96,room(b)*.75),at={x:b.x+Math.cos(f.phase)*r*(.28+v*.48),y:b.y+Math.sin(f.phase)*r*.34+r*(.07*v+.34*v*v)},g=f.g
      g.clear();fit(g,at,9);g.alpha=caught&&age>=0&&age<1.23?clamp(age/.16)*(1-clamp((v-.6)/.4))*.74:0
      g.circle(0,0,f.size).fill({color:0xdce5f1,alpha:.71}).circle(-.45,-.5,f.size*.35).fill(0xfff6f2)})
  }
  onFrame(update)
  tl.call(()=>update(.32),[],.32).call(()=>{caught=true;update(.94);onCue({type:'impact'})},[],.94).to({}, {duration:2.4},0)
}
