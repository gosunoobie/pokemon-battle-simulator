import { Container, Graphics } from 'pixi.js'

// Horizontal field haze has its own slow banks and crystalline clearing flecks.
export default function haze({ layer, scene, tl, onFrame, onCue, random }) {
  const { width: w, height: h } = scene
  const art = new Container(); art.label = 'move-artwork'; art.alpha = 0; layer.addChild(art)
  art.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x8aabbc, alpha: .045 }))
  const banks = Array.from({ length: 14 }, (_, i) => {
    const g = new Graphics().ellipse(0,0,w*.125,h*.045).fill({color:i%2?0xcbdbe5:0x9ab7c7,alpha:.13})
      .ellipse(-w*.018,-h*.014,w*.085,h*.026).fill({color:0xe4eef4,alpha:.09})
    g.label='haze-bank'; art.addChild(g)
    return {g,x:w*(.16+(i%4)*.225),y:h*(.18+Math.floor(i/4)*.195),phase:random()*6.28}
  })
  const flecks=Array.from({length:32},(_,i)=>{
    const r=Math.min(w,h)*.006, g=new Graphics().poly([0,-r,r*.65,0,0,r,-r*.65,0]).fill(0xdceef4)
    g.label='haze-fleck';art.addChild(g);return{g,x:w*(.06+random()*.88),y:h*(.12+random()*.72),phase:random()*6.28}
  })
  onFrame(time=>{
    banks.forEach(({g,x,y,phase},i)=>{g.position.set(x+Math.sin(time*.75+phase)*w*.022,y+Math.sin(time*.9+phase)*h*.014);g.scale.set(1+Math.sin(time+phase)*.025,1+Math.cos(time+phase)*.08);g.alpha=.5+Math.sin(time*.8+phase)**2*.45})
    flecks.forEach(({g,x,y,phase})=>{g.position.set(x+Math.sin(time*1.5+phase)*w*.012,y+Math.sin(time+phase)*h*.04);g.rotation=time*.35+phase;g.alpha=Math.sin(time*2+phase)**2*.48})
  })
  tl.to(art,{alpha:1,duration:.48},.04).to(art,{alpha:0,duration:.55},1.62).call(()=>onCue({type:'impact'}),[],.88)
}
