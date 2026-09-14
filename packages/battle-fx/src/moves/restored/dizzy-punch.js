import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dizzyPunch(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand',base=socket(attachment),center=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const w=context.source.metrics.width/unit,h=context.source.metrics.height/unit,r=Math.min(23,Math.max(16,h*.105))
  function fitPose(p){
    let rotation=p.rotation,c,s,rx,ry
    for(let i=0;i<12;i++){c=Math.cos(rotation);s=Math.sin(rotation);rx=(w*Math.abs(c)+h*Math.abs(s))/2;ry=(h*Math.abs(c)+w*Math.abs(s))/2;if(rx*2<=right-left&&ry*2<=bottom-top)break;rotation*=.5}
    const x=p.x+center.x*c-center.y*s,y=p.y+center.x*s+center.y*c
    return{x:p.x+Math.max(left+rx,Math.min(right-rx,x))-x,y:p.y+Math.max(top+ry,Math.min(bottom-ry,y))-y,rotation}
  }
  function rayRoom(p,angle){
    const x=Math.cos(angle),y=Math.sin(angle),limits=[]
    if(x>1e-6)limits.push((right-p.x-1)/x);if(x<-1e-6)limits.push((left-p.x+1)/x)
    if(y>1e-6)limits.push((bottom-p.y-1)/y);if(y<-1e-6)limits.push((top-p.y+1)/y)
    return Math.max(0,Math.min(...limits))
  }
  const root=new Container();root.label='dizzy-punch-root';temporary.addChild(root)
  const tip=new Graphics();tip.label='dizzy-punch-tip';root.addChild(tip)
  const swing=make('dizzy-punch-swing'),impact=make('dizzy-punch-impact'),orbit=make('dizzy-punch-star-orbit')
  const palette=[0xffd884,0xefa7a2,0xb5d9ee,0xc9b2e4,0xc1e4bb]
  const stars=Array.from({length:13},(_,i)=>({g:make(`dizzy-punch-star-${i}`),phase:i*Math.PI*2/13,color:palette[i%5]}))
  let struck=false
  function update(time){
    const b=targetSocket('center',true),aim=Math.atan2(b.y-base.y,b.x-base.x),length=r*2.5
    const contact=fitPose(solveContact(attachment,.055,{x:b.x-Math.cos(aim)*length,y:b.y-Math.sin(aim)*length}))
    const wind=clamp(time/.23),punch=clamp((time-.3)/.4)**3,recover=clamp((time-.87)/.56)
    const pre=fitPose({x:-11*wind,y:-5*wind,rotation:-.045*wind})
    const p=fitPose({x:(pre.x+(contact.x-pre.x)*punch)*(1-recover),y:(pre.y+(contact.y-pre.y)*punch)*(1-recover),rotation:(pre.rotation+(contact.rotation-pre.rotation)*punch)*(1-recover)})
    attacker.position.copyFrom(p);attacker.rotation=p.rotation
    const from=socket(attachment,true),c=Math.cos(contact.rotation),s=Math.sin(contact.rotation),finalRoot={x:contact.x+base.x*c-base.y*s,y:contact.y+base.x*s+base.y*c}
    const angle=Math.atan2(b.y-finalRoot.y,b.x-finalRoot.x),reach=Math.min(Math.hypot(b.x-finalRoot.x,b.y-finalRoot.y),rayRoom(from,angle)),cos=Math.cos(angle),sin=Math.sin(angle)
    root.position.copyFrom(from);root.alpha=time>=.12&&time<1.2?Math.min(1,(time-.12)/.15,(1.2-time)/.28):0
    tip.position.set(cos*reach,sin*reach);tip.clear()
    // Fit each cross-section while the wrist stays on the real socket and the front knuckle stays at local zero.
    const point=(u,v)=>{
      const axis={x:from.x+cos*reach*u,y:from.y+sin*reach*u},width=Math.sign(v)*Math.min(Math.abs(v*r),room(axis)*.77)
      return[cos*reach*(u-1)-sin*width,sin*reach*(u-1)+cos*width]
    }
    const poly=points=>points.flatMap(([u,v])=>point(u,v))
    tip.poly(poly([[0,-.4],[.36,-.57],[.47,-.86],[.65,-.9],[.72,-.61],[.85,-.64],[.96,-.42],[1,0],[.96,.44],[.72,.57],[.6,.94],[.4,.76],[.27,.46],[0,.4]]))
      .fill(0xd98883).stroke({color:0xf6d6b0,width:1.4,alpha:.84,join:'round'})
      .poly(poly([[.33,-.38],[.51,-.69],[.81,-.49],[.94,-.18],[.97,.15],[.76,.4],[.53,.43],[.37,.22]]))
      .fill(0xf5ca86)
    for(let j=0;j<3;j++)tip.moveTo(...point(.53+j*.13,-.48+j*.06)).lineTo(...point(.56+j*.12,.13+j*.03)).stroke({color:0xffebc2,width:1.5,alpha:.83})
    tip.moveTo(...point(.36,.3)).quadraticCurveTo(...point(.5,.08),...point(.66,.5)).stroke({color:0xb96377,width:1.5,alpha:.77})
    swing.clear();swing.alpha=root.alpha*.53
    const front={x:from.x+cos*reach,y:from.y+sin*reach}
    for(let j=0;j<3;j++){
      const off=(j-1)*Math.min(r*.64,room(from)*.3,room(front)*.3)
      swing.moveTo(from.x-sin*off,from.y+cos*off).quadraticCurveTo((from.x+front.x)/2-sin*off*.6,(from.y+front.y)/2+cos*off*.6,front.x,front.y)
        .stroke({color:palette[j],width:1.6,alpha:.52,cap:'round'})
    }
    const age=time-.7,u=clamp(age/.47)
    impact.clear();fit(impact,b,81);impact.alpha=struck&&age>=0&&age<.56?1-age/.56:0
    const points=[];for(let j=0;j<10;j++){const theta=-Math.PI/2+j*Math.PI/5,rad=(j%2?17:43)*(1+u*.33);points.push(Math.cos(theta)*rad,Math.sin(theta)*rad)}
    impact.poly(points).fill({color:0xffdfa3,alpha:.61}).circle(0,0,10+u*24).stroke({color:0xf1b4bb,width:2.4,alpha:.71})
    const fade=struck&&age>=0?clamp(age/.11)*(1-clamp((time-1.44)/.43)):0,rad=Math.min(69,room(b)*.76)
    orbit.clear();fit(orbit,b,87);orbit.alpha=fade*.47
    orbit.ellipse(0,-16,63,26).stroke({color:0xdbb7ce,width:1.2,alpha:.55})
    for(const star of stars){
      const theta=star.phase+age*2.25,spread=.64+.22*Math.sin(age*3+star.phase)**2,q={x:b.x+Math.cos(theta)*rad*spread,y:b.y+Math.sin(theta)*rad*.47-rad*.18}
      const g=star.g;g.clear();fit(g,q,12);g.rotation=-theta;g.alpha=fade*(.49+.37*Math.sin(theta)**2)
      const points=[];for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,r=j%2?3.1:7.1;points.push(Math.cos(a)*r,Math.sin(a)*r)}
      g.poly(points).fill(star.color).circle(0,0,1.5).fill(0xfff3d4)
    }
  }
  onFrame(update)
  tl.call(()=>{struck=true;update(.7);onCue({type:'impact'})},[],.7).to({},{duration:1.95},0)
}
