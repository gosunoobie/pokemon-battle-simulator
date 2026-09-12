import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function brickBreak(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const size=Math.min(1.2,Math.max(.75,context.target.metrics.height/unit/170)),point={x:focus.x,y:focus.y+6}
  const pose=solveContact('hand',.11,point),raised=solveContact('hand',-.11,{x:point.x-35*size,y:point.y-54*size})
  const panel=new Container();panel.label='brick-break-panel';panel.position.copyFrom(point);panel.scale.set(size);temporary.addChild(panel)
  const tiles=[]
  for(let row=0;row<3;row++)for(let col=0;col<2;col++){
    const tile=new Graphics().poly([-13,-10,12,-10,14,9,-11,9]).fill({color:(row+col)%2?0xd8b488:0xe8cba6,alpha:.22})
      .stroke({color:0xffe5bc,width:1.5,alpha:.82}).moveTo(-10,-7).lineTo(9,-7).stroke({color:0xfff3d5,width:1,alpha:.75})
    const x=(col-.5)*28,y=(row-1)*21;tile.position.set(x,y);tile.alpha=0;panel.addChild(tile)
    tiles.push({tile,x,y,side:col?1:-1,vx:(col?1:-1)*(35+random()*40),vy:-25+row*18,spin:(col?1:-1)*(1.5+random())})
  }
  const crack=new Graphics().moveTo(1,-34).lineTo(-5,-18).lineTo(5,-4).lineTo(-6,10).lineTo(1,33)
    .moveTo(5,-4).lineTo(23,-15).moveTo(-6,10).lineTo(-24,19).stroke({color:0xfff6dc,width:2.8,cap:'round',join:'round'})
  crack.alpha=0;panel.addChild(crack)
  const hand=new Graphics().roundRect(-12,-18,23,30,6).fill(0xf4d1a4).stroke({color:0xc08d65,width:1.7})
    .moveTo(-7,-12).lineTo(6,-12).moveTo(-7,-7).lineTo(6,-7).stroke({color:0xba895f,width:1.2,alpha:.8})
  hand.label='brick-break-hand';hand.alpha=0;hand.scale.set(size);temporary.addChild(hand)
  const follow=()=>{hand.position.copyFrom(socket('hand',true));hand.rotation=attacker.rotation-.15}
  const chips=[]
  for(let i=0;i<16;i++){
    const g=new Graphics().poly([-2,-3,3,-2,2,3,-3,1]).fill(i%2?0xf8d9a7:0xbb9970);g.alpha=0;temporary.addChild(g)
    chips.push({g,angle:random()*Math.PI*2,speed:40+random()*75,life:.4+random()*.15})
  }
  onFrame(time=>{
    follow();const age=time-.68
    for(const p of tiles){
      const t=Math.max(0,age-.035)
      p.tile.position.set(p.x+p.vx*t,p.y+p.vy*t+95*t*t);p.tile.rotation=t*p.spin
      p.tile.alpha=Math.min(1,Math.max(0,(time-.28)/.18))*Math.max(0,1-t/.65)
    }
    for(const p of chips){if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age+80*age*age);p.g.rotation=p.angle+age*5;p.g.alpha=Math.sin(Math.PI*age/p.life)*.85}
  })
  const shock=new Graphics().ellipse(0,0,26*size,14*size).stroke({color:0xffe8bb,width:3})
  shock.position.copyFrom(point);shock.alpha=0;temporary.addChild(shock)
  tl.to(attacker,{x:home.x-10,rotation:-.07,duration:.18},0)
    .to(attacker,{...raised,duration:.32,ease:'power2.out'},.18)
    .to(attacker,{...pose,duration:.18,ease:'power3.in'},.5)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.48,ease:'power2.inOut'},.88)
    .to(hand,{alpha:.95,duration:.12},.3).to(hand,{alpha:0,duration:.22},.82)
    .to(crack,{alpha:1,duration:.025},.68).to(crack,{alpha:0,duration:.21},.74)
    .to(shock,{alpha:.85,duration:.025},.68).to(shock.scale,{x:1.8,y:1.65,duration:.3},.68).to(shock,{alpha:0,duration:.23},.75)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xf2d2a7},[],.68)
    .to(defender,{x:defenderHome.x+11,duration:.065,repeat:5,yoyo:true},.68)
    .call(()=>{defender.tint=0xffffff},[],.94)
}
