import { Container, Graphics } from 'pixi.js'

export default function perishSong(context) {
  const { tl, onFrame, onCue, layer, scene, source } = context
  const art = new Container(); art.label = 'move-artwork'; layer.addChild(art)
  const wash = new Graphics().rect(0,0,scene.width,scene.height).fill({color:0x534161,alpha:.09})
  wash.alpha=0;art.addChild(wash)
  const score=new Graphics();score.label='perish-song-score';score.alpha=0;art.addChild(score)
  const pulses=Array.from({length:3},(_,i)=>{const g=new Graphics();g.label=`perish-song-pulse-${i}`;g.alpha=0;art.addChild(g);return g})
  const notes=Array.from({length:18},(_,i)=>{
    const g=new Graphics().ellipse(-2,4,4,2.8).fill(i%2?0xd5a9dd:0xb7acd8).moveTo(2,4).lineTo(2,-11).lineTo(10,-8).stroke({color:i%2?0xd5a9dd:0xb7acd8,width:2})
    g.scale.set(scene.unit);g.alpha=0;g.label=`perish-song-note-${i}`;art.addChild(g);return g
  })
  function update(time){
    const from=source.anchor('emission'),pad=Math.min(20*scene.unit,scene.width*.04,scene.height*.04)
    pulses.forEach((g,i)=>{const age=time-.16-i*.24,u=Math.max(0,Math.min(1,age/.95)),rx=Math.min(from.x-pad,scene.width-from.x-pad)*(.1+u*.85),ry=Math.min(from.y-pad,scene.height-from.y-pad)*(.1+u*.85)
      g.clear().ellipse(from.x,from.y,Math.max(0,rx),Math.max(0,ry)).stroke({color:0xc59ccd,width:2*scene.unit,alpha:.6});g.alpha=age>=0&&age<1.2?Math.sin(Math.PI*Math.min(1,age/1.2)):.0})
    score.clear()
    for(let lane=0;lane<3;lane++){
      for(let j=0;j<=50;j++){const u=j/50,x=pad+(scene.width-pad*2)*u,y=scene.height*(.3+lane*.18)+Math.sin(u*Math.PI*3-time*2+lane)*scene.height*.028;j?score.lineTo(x,y):score.moveTo(x,y)}
      score.stroke({color:lane===1?0xb8a1cb:0x967fab,width:scene.unit*1.2,alpha:.32})
    }
    notes.forEach((g,i)=>{const age=time-.24-i*.055,u=Math.max(0,Math.min(1,age/1.65)),lane=i%3
      g.position.set(pad+(scene.width-pad*2)*((i/18+u*.13)%1),scene.height*(.3+lane*.18)+Math.sin(time*2+i)*scene.height*.025)
      g.alpha=age>=0&&age<1.65?Math.sin(Math.PI*u)*.8:0;g.rotation=Math.sin(time*3+i)*.09
    })
  }
  onFrame(update)
  tl.to(wash,{alpha:1,duration:.4},.06).to(wash,{alpha:0,duration:.5},2.34)
    .to(score,{alpha:1,duration:.5},.2).to(score,{alpha:0,duration:.5},2.34)
    .call(()=>{update(1.12);onCue({type:'impact'})},[],1.12)
}
