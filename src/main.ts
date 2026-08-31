import './style.css';
import * as THREE from 'three';
import { Track, SAMPLE_COUNT, CHECKPOINT_COUNT, TRACK_WIDTH } from './track';
import { Racer, ITEM_NAMES } from './racer';
import { ItemSystem } from './items';
import type { InputState } from './types';

type Difficulty='easy'|'medium'|'hard';
const DIFFICULTY={
  easy:{speed:.86,lookAhead:.78,precision:.72,aggression:.2,itemRate:.07,curvePace:.82,drift:false},
  medium:{speed:1,lookAhead:1,precision:1,aggression:.62,itemRate:.2,curvePace:1,drift:true},
  hard:{speed:1.08,lookAhead:1.18,precision:1.16,aggression:1,itemRate:.38,curvePace:1.06,drift:true}
} as const;

class Game {
  scene=new THREE.Scene(); renderer:THREE.WebGLRenderer; camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,600);
  track:Track; racers:Racer[]=[]; player:Racer; items:ItemSystem; keys=new Set<string>();
  clock=new THREE.Clock(); elapsed=0; countdown=0; paused=false; raceStarted=false; raceEnded=false; debug=false; difficulty:Difficulty='medium'; resultOrder:Racer[]=[];
  cameraPos=new THREE.Vector3(); cameraLook=new THREE.Vector3(); messageTime=0;
  frameDt=1/60;
  ui={position:el('position'),lap:el('lap'),speed:el('speed'),item:el('item'),countdown:el('countdown'),message:el('message'),boost:el('boost'),pause:el('pause'),startMenu:el('startMenu'),results:el('results'),resultTitle:el('resultTitle'),resultList:el('resultList'),debug:el('debugPanel'),minimap:document.querySelector('#minimap') as HTMLCanvasElement};

  constructor(){
    const canvas=document.querySelector('#game') as HTMLCanvasElement;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.scene.background=new THREE.Color(0x8ac8d8);this.scene.fog=new THREE.FogExp2(0x8ac8d8,.0031);
    const hemi=new THREE.HemisphereLight(0xc8f6ff,0x244433,2.1);this.scene.add(hemi);const sun=new THREE.DirectionalLight(0xfff0d3,3.4);sun.position.set(-55,90,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-130;sun.shadow.camera.right=130;sun.shadow.camera.top=130;sun.shadow.camera.bottom=-130;this.scene.add(sun);
    this.track=new Track(this.scene);this.player=new Racer('DU',true,0x34e8cc,this.scene,1);this.racers.push(this.player);
    const names=['VEX','KODA','ZIN','ORBIT','MICA'];const colors=[0xff5264,0xffc94b,0x9b73ff,0x49a2ff,0xf572d0];const skills=[.82,.9,.98,1.05,1.12];const lanes=[-2.7,2.4,-1.1,1.2,0];
    for(let i=0;i<5;i++){const bot=new Racer(names[i],false,colors[i],this.scene,skills[i]);bot.preferredLane=lanes[i];bot.raceLane=lanes[i];this.racers.push(bot)}
    this.racers.forEach((r,i)=>{r.spawn(this.track,(SAMPLE_COUNT-i*6)%SAMPLE_COUNT,(i%2?1:-1)*(1.7+Math.floor(i/2)*.15));r.progress.totalProgress=-i*6;r.lastProgress=r.progress.totalProgress});
    this.items=new ItemSystem(this.scene,this.track);this.bind();this.validate();this.animate();
  }

  bind(){
    addEventListener('keydown',e=>{this.keys.add(e.code);if(e.code==='KeyE'&&!e.repeat&&this.raceStarted&&this.countdown<=0&&!this.paused)this.items.use(this.player);if(e.code==='KeyP'&&!e.repeat)this.togglePause();if(e.code==='KeyR'&&!e.repeat&&this.raceStarted)this.player.respawn(this.track);if(e.code==='F3'&&!e.repeat){e.preventDefault();this.debug=!this.debug;this.track.debug.visible=this.debug;document.body.classList.toggle('debug',this.debug);for(const r of this.racers)r.targetMarker.visible=this.debug}});
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)});el('restartButton').addEventListener('click',()=>location.reload());document.addEventListener('visibilitychange',()=>{if(document.hidden&&!this.paused&&!this.raceEnded)this.togglePause()});
    for(const button of document.querySelectorAll<HTMLButtonElement>('[data-difficulty]'))button.addEventListener('click',()=>{this.difficulty=button.dataset.difficulty as Difficulty;for(const other of document.querySelectorAll('[data-difficulty]'))other.classList.toggle('selected',other===button)});
    el('startRace').addEventListener('click',()=>this.startRace());
  }
  startRace(){const config=DIFFICULTY[this.difficulty];for(const bot of this.racers.slice(1))bot.maxSpeed=(32+bot.skill*6)*config.speed;this.raceStarted=true;this.countdown=3.6;this.ui.startMenu.classList.add('hidden');this.clock.getDelta()}
  togglePause(){if(!this.raceStarted||this.raceEnded)return;this.paused=!this.paused;this.ui.pause.classList.toggle('hidden',!this.paused);if(!this.paused)this.clock.getDelta()}
  playerInput():InputState{return{throttle:(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0),steer:(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)-(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0),drift:this.keys.has('Space')}}

  botInput(bot:Racer,dt:number):InputState{
    const config=DIFFICULTY[this.difficulty];
    bot.stateTime+=dt;const current=bot.progress.trackIndex;const progressed=bot.progress.totalProgress-bot.lastProgress;if(Math.abs(bot.speed)<1.5)bot.slowTime+=dt;else bot.slowTime=0;if(progressed<.3)bot.noProgressTime+=dt;else{bot.noProgressTime=0;bot.lastProgress=bot.progress.totalProgress}
    if(bot.botState==='race'&&bot.stateTime>8)bot.recoveryAttempts=0;
    if(bot.botState==='race'&&(bot.slowTime>2||bot.noProgressTime>3)){if(bot.recoveryAttempts>0){bot.respawn(this.track)}else{bot.recoveryAttempts++;bot.botState='reverse';bot.stateTime=0}}
    if(bot.botState==='reverse'&&bot.stateTime>1){bot.botState='realign';bot.stateTime=0}
    if(bot.botState==='realign'&&bot.stateTime>1.1){bot.botState='race';bot.stateTime=0;bot.slowTime=0;bot.noProgressTime=0}
    let desiredLane=bot.preferredLane,avoidThrottle=1;const currentSample=this.track.sample(current);
    for(const other of this.racers){if(other===bot)continue;const gap=other.progress.totalProgress-bot.progress.totalProgress;const distance=bot.root.position.distanceTo(other.root.position);if(gap>0&&gap<16+config.aggression*9&&distance<10+config.aggression*4){const otherLane=other.root.position.clone().sub(currentSample.position).dot(currentSample.right);desiredLane=config.aggression<.35?0:(otherLane>=0?-3.4:3.4);if(distance<5.5+config.aggression)avoidThrottle=-.55}}
    const currentLateral=bot.root.position.clone().sub(currentSample.position).dot(currentSample.right);if(Math.abs(currentLateral)>TRACK_WIDTH*.39)desiredLane=0;bot.raceLane=THREE.MathUtils.lerp(bot.raceLane,desiredLane,1-Math.pow(.035,dt));
    const look=Math.floor((10+Math.abs(bot.speed)*.55)*config.lookAhead);const target=this.track.sample(current+look);const targetPoint=target.position.clone().addScaledVector(target.right,bot.raceLane);bot.targetMarker.position.copy(targetPoint).add(new THREE.Vector3(0,1.3,0));const desired=Math.atan2(targetPoint.x-bot.root.position.x,targetPoint.z-bot.root.position.z);let angle=wrap(desired-bot.heading);const trackHeading=Math.atan2(target.tangent.x,target.tangent.z);const feedForward=wrap(trackHeading-Math.atan2(currentSample.tangent.x,currentSample.tangent.z));const error=Math.sin(this.elapsed*.65+bot.rank*1.7)*(1-config.precision)*.22;let steer=THREE.MathUtils.clamp((angle*2.25+feedForward*.85)*config.precision+error,-1,1);
    let curvature=0;let previous=this.track.sample(current+7).tangent;for(const ahead of [16,28,42,58]){const tangent=this.track.sample(current+ahead).tangent;curvature=Math.max(curvature,previous.angleTo(tangent));previous=tangent}const curveSpeed=bot.maxSpeed*THREE.MathUtils.clamp((1.06-curvature*1.15)*config.curvePace,.36,1);const minCruise=bot.maxSpeed*.27;let throttle=avoidThrottle<0?avoidThrottle:(bot.speed<Math.max(minCruise,curveSpeed)?1:-.48);
    if(current>=this.track.jumpStart-18&&current<this.track.jumpEnd&&bot.speed<25)throttle=1;
    if(Math.abs(currentLateral)>TRACK_WIDTH*.4)steer=THREE.MathUtils.clamp(steer-Math.sign(currentLateral)*.9,-1,1);
    if(bot.botState==='reverse')return{throttle:-1,steer:-Math.sign(angle||1),drift:false};if(bot.botState==='realign')return{throttle:.7,steer,drift:false};
    if(bot.item&&Math.random()<dt*config.itemRate*(.7+bot.skill*.35))this.items.use(bot);
    return{throttle,steer,drift:config.drift&&curvature>.11&&Math.abs(steer)>.3&&bot.speed>16};
  }

  update(dt:number){
    this.frameDt=dt;if(!this.raceStarted){this.updateCamera(dt);this.updateHud();this.drawMinimap();return}this.elapsed+=dt;
    if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);this.ui.countdown.textContent=this.countdown>.6?String(Math.ceil(this.countdown-.6)):this.countdown>0?'GO!':''}else this.ui.countdown.textContent='';
    const active=this.countdown<=0&&!this.raceEnded;
    this.player.update(dt,this.playerInput(),this.track,active);
    for(const b of this.racers.slice(1))b.update(dt,this.botInput(b,dt),this.track,active);
    this.resolveRacerCollisions();this.items.update(dt,this.racers);this.rankAndFinish();this.updateCamera(dt);this.updateHud();this.drawMinimap();
  }

  resolveRacerCollisions(){for(let i=0;i<this.racers.length;i++)for(let j=i+1;j<this.racers.length;j++){const a=this.racers[i],b=this.racers[j];const d=a.root.position.clone().sub(b.root.position);d.y=0;const len=d.length();if(len<2.15&&len>.01){d.multiplyScalar((2.15-len)/len*.52);a.root.position.add(d);b.root.position.sub(d);const avg=(a.speed+b.speed)/2;a.speed=THREE.MathUtils.lerp(a.speed,avg,.28);b.speed=THREE.MathUtils.lerp(b.speed,avg,.28)}}}
  rankAndFinish(){const sorted=[...this.racers].sort((a,b)=>{if(a.progress.finished!==b.progress.finished)return a.progress.finished?-1:1;if(a.progress.finished)return a.progress.finishTime-b.progress.finishTime;return b.progress.totalProgress-a.progress.totalProgress});sorted.forEach((r,i)=>r.rank=i+1);for(const r of sorted){if(!r.progress.finished&&r.progress.lap>=3){r.progress.finished=true;r.progress.finishTime=this.elapsed;this.resultOrder.push(r);if(r.isPlayer)setTimeout(()=>this.showResults(),900)}}}
  showResults(){if(this.raceEnded)return;this.raceEnded=true;this.ui.results.classList.remove('hidden');this.ui.resultTitle.textContent=`PLATZ ${this.player.rank}`;this.ui.resultList.innerHTML=[...this.racers].sort((a,b)=>a.rank-b.rank).map(r=>`<li><b>${r.name}</b> ${r.progress.finished?formatTime(r.progress.finishTime):'noch unterwegs'}</li>`).join('')}

  updateCamera(dt:number){const forward=new THREE.Vector3(Math.sin(this.player.heading),0,Math.cos(this.player.heading));const desired=this.player.root.position.clone().addScaledVector(forward,-8.5).add(new THREE.Vector3(0,5.2,0));const look=this.player.root.position.clone().addScaledVector(forward,5).add(new THREE.Vector3(0,1,0));this.cameraPos.lerp(desired,1-Math.pow(.001,dt));this.cameraLook.lerp(look,1-Math.pow(.0002,dt));this.camera.position.copy(this.cameraPos);this.camera.lookAt(this.cameraLook);this.camera.fov=65+Math.min(10,Math.abs(this.player.speed)*.22);this.camera.updateProjectionMatrix()}
  updateHud(){this.ui.position.textContent=`${this.player.rank} / ${this.racers.length}`;this.ui.lap.textContent=`${Math.min(3,this.player.progress.lap+1)} / 3`;this.ui.speed.textContent=String(Math.round(Math.abs(this.player.speed)*3.6)).padStart(3,'0');this.ui.item.textContent=this.player.item?ITEM_NAMES[this.player.item]:'—';this.ui.boost.classList.toggle('active',this.player.boostTime>0);if(this.messageTime>0){this.messageTime-=this.frameDt}else this.ui.message.textContent='';if(this.debug)this.ui.debug.textContent=`VALIDIERUNG: OK\nSCHWIERIGKEIT: ${this.difficulty.toUpperCase()}\nFPS: ${Math.round(1/Math.max(.001,this.frameDt))}\nTrack sample: ${this.player.progress.trackIndex}\nCheckpoint: ${this.player.progress.checkpoint}/${CHECKPOINT_COUNT}\nOffroad: ${this.player.offTrackTime.toFixed(1)}s\n\nBOTS\n`+this.racers.slice(1).map(b=>`${b.name.padEnd(6)} ${b.botState.padEnd(8)} ${b.speed.toFixed(1).padStart(5)} m/s  L${Math.min(3,b.progress.lap+1)} CP${b.progress.checkpoint}`).join('\n')}
  drawMinimap(){const c=this.ui.minimap.getContext('2d')!,w=this.ui.minimap.width,h=this.ui.minimap.height;c.clearRect(0,0,w,h);c.save();c.translate(w/2,h/2);const scale=.72;c.strokeStyle='#416373';c.lineWidth=10;c.lineJoin='round';c.beginPath();for(let i=0;i<this.track.samples.length;i+=3){const p=this.track.samples[i].position;if(i===0)c.moveTo(p.x*scale,p.z*scale);else c.lineTo(p.x*scale,p.z*scale)}c.closePath();c.stroke();c.strokeStyle='#80ffe7';c.lineWidth=2;c.stroke();for(const r of this.racers){c.fillStyle=r.isPlayer?'#fff':`#${r.color.toString(16).padStart(6,'0')}`;c.beginPath();c.arc(r.root.position.x*scale,r.root.position.z*scale,r.isPlayer?5:3.5,0,Math.PI*2);c.fill()}c.restore()}

  validate(){const errors:string[]=[];if(this.track.samples.length!==SAMPLE_COUNT)errors.push('Ungültige Waypoint-Anzahl');if(this.track.checkpoints.length<10)errors.push('Zu wenige Checkpoints');for(const s of this.track.samples)if(!Number.isFinite(s.position.x+s.position.y+s.position.z+s.tangent.x))errors.push(`NaN an ${s.index}`);for(let i=0;i<SAMPLE_COUNT;i++)for(let j=i+30;j<SAMPLE_COUNT;j++){if(Math.abs(i-j)>SAMPLE_COUNT-30)continue;const a=this.track.sample(i),b=this.track.sample(j);const horizontal=Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);if(horizontal<TRACK_WIDTH&&Math.abs(a.position.y-b.position.y)<5)errors.push(`Unsichere Streckenkreuzung ${i}/${j}`)}for(const box of this.track.decorationBounds){for(let i=0;i<SAMPLE_COUNT;i+=3){const s=this.track.sample(i);if(box.distanceToPoint(s.position)<TRACK_WIDTH/2+1.4)errors.push(`Dekoration im Fahrkorridor bei ${i}`)}}const unique=[...new Set(errors)];if(unique.length){console.error('Streckenvalidierung fehlgeschlagen',unique);this.ui.message.textContent=`VALIDIERUNGSFEHLER: ${unique[0]}`;this.messageTime=999}else console.info(`Streckenvalidierung OK: ${SAMPLE_COUNT} Waypoints, ${CHECKPOINT_COUNT} Checkpoints, ${this.track.decorationBounds.length} geprüfte Dekorationen`)}
  animate=()=>{requestAnimationFrame(this.animate);let dt=Math.min(this.clock.getDelta(),.04);if(!this.paused)this.update(dt);this.renderer.render(this.scene,this.camera)}
}

function el(id:string){return document.getElementById(id)!}
function wrap(a:number){return Math.atan2(Math.sin(a),Math.cos(a))}
function formatTime(sec:number){const m=Math.floor(sec/60),s=(sec%60).toFixed(2).padStart(5,'0');return `${m}:${s}`}
new Game();
