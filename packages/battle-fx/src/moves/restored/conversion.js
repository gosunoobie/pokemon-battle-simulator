import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A digital mosaic assembles, changes order and falls apart in pixels.
export default function conversion(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const art = new Container(); art.label = 'conversion-mosaic'; art.alpha = 0; temporary.addChild(art)
  const colors = [0xe3b5dd, 0xa8dce8, 0xebd99f, 0xc9b9ee]
  const tiles = Array.from({ length: 25 }, (_, i) => { const g = new Graphics().rect(-6,-6,12,12).fill({ color: colors[i % 4], alpha: .3 }).stroke({ color: colors[(i+1)%4], width: 1.4 }); g.label = 'conversion-tile'; art.addChild(g); return g })
  const scan = new Graphics().moveTo(-66,0).lineTo(66,0).stroke({ color: 0xf8e9fc, width: 2, alpha: .7 }); art.addChild(scan)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges), right=Math.max(...edges), top=-temporary.y/unit, bottom=(context.scene.height-temporary.y)/unit
  function update(time) {
    const p=socket('visualCenter',true), room=Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-3)
    art.position.copyFrom(p); art.scale.set(Math.min(1,room/104))
    tiles.forEach((g,i)=>{ const age=time-.1-i*.011, u=Math.max(0,Math.min(1,age/.66)), a=i*2.4+(1-u)*1.3, scatter=Math.max(0,time-1.3)*22
      const x=(i%5-2)*24,y=(Math.floor(i/5)-2)*24
      g.position.set(x*u+Math.cos(a)*(1-u)*79+Math.sin(i)*scatter,y*u+Math.sin(a)*(1-u)*79+scatter*.3)
      g.rotation=(1-u)*Math.PI*.5+Math.sin(time*3+i)*.055;g.scale.set(.5+u*.5);g.alpha=u*(.48+Math.sin(time*4+i)**2*.45)
    })
    scan.y=Math.sin((time-.15)*2.7)*64;scan.alpha=Math.sin(Math.min(1,time/.4)*Math.PI/2)*.65
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.24},.04).to(art,{alpha:0,duration:.45},1.6)
    .call(()=>{update(.86);onCue({type:'impact'})},[],.86)
}
