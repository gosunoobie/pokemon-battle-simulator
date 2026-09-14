import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function helpingHand(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('helping-hand-root'),tip=make('helping-hand-tip'),impact=make('helping-hand-impact')
  root.attachmentSocket='center'
  const hands=[make('helping-hand-left-palm'),make('helping-hand-right-palm')]
  const applause=Array.from({length:18},(_,i)=>({g:make(`helping-hand-applause-${i}`),start:.66+i*.028,side:i%2?-1:1,phase:random()*6.28,size:3+random()*3}))
  let clapped=false
  function update(time){
    const c=socket('center',true),r=Math.min(77,room(c)*.64),age=time-.66,fade=1-clamp((time-1.32)/.37)
    root.clear();fit(root,c,91);root.alpha=time>=.1&&time<1.69?clamp((time-.1)/.15)*fade:0
    for(let i=0;i<2;i++){
      const side=i?-1:1,beat=time<.66?clamp((time-.16)/.5):1-Math.sin(clamp(age/.68)*Math.PI)*.33
      const spread=r*(.83-beat*.53),at={x:c.x+side*spread,y:c.y+Math.sin(time*6)*3}
      const g=hands[i];g.clear();fit(g,at,63);g.rotation=side*(-.12+beat*.22)
      const mirror=side,points=[-23,34,-25,8,-19,-4,-11,-28,-6,-38,0,-37,2,-30,0,-12,9,-34,15,-34,18,-28,11,-7,21,-26,27,-24,28,-18,19,3,29,-9,35,-6,34,2,19,30,10,40]
      g.poly(points.map((v,j)=>j%2?v:v*mirror)).fill({color:i?0xffd894:0xffebbf,alpha:.91}).stroke({color:0xc39a61,width:1.8,alpha:.75,join:'round'})
      g.moveTo(-16*mirror,4).quadraticCurveTo(1*mirror,9,10*mirror,20).stroke({color:0xd4ae74,width:1.7,alpha:.75})
        .poly([-22*mirror,28,15*mirror,32,11*mirror,43,-21*mirror,39]).fill({color:i?0xc7c58a:0xe2b67e,alpha:.87})
      g.alpha=root.alpha
    }
    // A compact clap flash and radiating dash marks stay centered on the user.
    tip.clear();fit(tip,c,33);tip.alpha=time>=.48&&time<1.15?1-clamp((time-.8)/.35):0
    tip.poly([0,-27,5,-8,19,-19,11,-3,29,1,10,6,18,24,3,11,-5,29,-8,9,-27,18,-15,2,-30,-6,-10,-8,-18,-25,-3,-13]).fill({color:0xffedb4,alpha:.8})
    impact.clear();fit(impact,c,83);const u=clamp(age/.7);impact.alpha=clapped&&age>=0&&age<.7?1-u:0
    for(let i=0;i<10;i++){const q=i*Math.PI/5+Math.sin(time*3)*.08,a=21+u*38,b=a+11;impact.moveTo(Math.cos(q)*a,Math.sin(q)*a).lineTo(Math.cos(q)*b,Math.sin(q)*b).stroke({color:i%2?0xd5dca0:0xffdfa0,width:3-u,alpha:.76,cap:'round'})}
    applause.forEach(p=>{
      const age=time-p.start,v=clamp(age/.95),extent=Math.min(79,room(c)*.75),at={x:c.x+p.side*extent*(.16+v*.51)+Math.sin(p.phase+v*4)*extent*.07,y:c.y-extent*(.05+v*.61)}
      const g=p.g;g.clear();fit(g,at,16);g.rotation=p.side*(.13+Math.sin(time*4+p.phase)*.17)
      g.alpha=clapped&&age>=0&&age<.95?clamp(age/.1)*(1-clamp((v-.53)/.47))*.77:0
      const s=p.size;g.moveTo(-s,3).lineTo(0,-s).lineTo(s,3).stroke({color:p.side<0?0xffe9b8:0xdbe2a1,width:2.1,alpha:.92,cap:'round'})
      if(p.side>0)g.moveTo(-s,8).lineTo(0,8-s).lineTo(s,8).stroke({color:0xe2d998,width:1.2,alpha:.6})
    })
  }
  onFrame(update)
  tl.call(()=>{clapped=true;update(.66);onCue({type:'impact'})},[],.66).to({}, {duration:1.9},0)
}
