import * as THREE from 'three';
import type { BotState, InputState, ItemType, RacerProgress } from './types';
import { CHECKPOINT_COUNT, SAMPLE_COUNT, Track, TRACK_WIDTH } from './track';

export const ITEM_NAMES: Record<ItemType,string>={boost:'NITRO',pulse:'PULS',barrier:'BLOCKER',shield:'SCHILD'};

export class Racer {
  readonly root=new THREE.Group();
  readonly body:THREE.Mesh;
  readonly wheels:THREE.Mesh[]=[];
  readonly shieldMesh:THREE.Mesh;
  readonly targetMarker:THREE.Mesh;
  readonly progress:RacerProgress={lap:0,checkpoint:1,trackIndex:0,totalProgress:0,finished:false,finishTime:0};
  velocity=new THREE.Vector3();
  speed=0; heading=0; steerValue=0; verticalVelocity=0; grounded=true; airTime=0; jumpCooldown=0; driftCharge=0; boostTime=0; shieldTime=0; stunTime=0;
  item:ItemType|null=null; lastValidIndex=0; offTrackTime=0; noProgressTime=0; slowTime=0; lastProgress=0;
  botState:BotState='race'; stateTime=0; recoveryAttempts=0; skill=1; maxSpeed=36; color:number; rank=1; preferredLane=0; raceLane=0;

  constructor(readonly name:string,readonly isPlayer:boolean,color:number,scene:THREE.Scene,skill=1){
    this.color=color;this.skill=skill;this.maxSpeed=32+skill*6;
    const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.35});
    this.body=new THREE.Mesh(new THREE.BoxGeometry(2.1,.65,3.25),bodyMat);this.body.position.y=.65;this.body.castShadow=true;this.root.add(this.body);
    const nose=new THREE.Mesh(new THREE.BoxGeometry(1.55,.35,1.1),bodyMat);nose.position.set(0,.52,1.85);nose.rotation.x=-.1;nose.castShadow=true;this.root.add(nose);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(1.2,.8,1),new THREE.MeshStandardMaterial({color:0x15242f,roughness:.7}));seat.position.set(0,1.05,-.2);this.root.add(seat);
    const driver=new THREE.Mesh(new THREE.SphereGeometry(.42,12,8),new THREE.MeshStandardMaterial({color:0xf0b28d}));driver.position.set(0,1.75,-.1);this.root.add(driver);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.47,12,8,0,Math.PI*2,0,Math.PI*.55),bodyMat);helmet.position.copy(driver.position);helmet.position.y+=.1;this.root.add(helmet);
    const wheelGeo=new THREE.CylinderGeometry(.43,.43,.38,12);const wheelMat=new THREE.MeshStandardMaterial({color:0x101316,roughness:.8});
    for(const x of [-1.14,1.14])for(const z of [-1.1,1.12]){const w=new THREE.Mesh(wheelGeo,wheelMat);w.rotation.z=Math.PI/2;w.position.set(x,.45,z);w.castShadow=true;this.root.add(w);this.wheels.push(w)}
    const wing=new THREE.Mesh(new THREE.BoxGeometry(2.4,.18,.45),bodyMat);wing.position.set(0,1,-1.75);this.root.add(wing);
    this.shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(2.3,20,12),new THREE.MeshBasicMaterial({color:0x48dfff,transparent:true,opacity:.18,wireframe:true,depthWrite:false}));this.shieldMesh.position.y=.8;this.shieldMesh.visible=false;this.root.add(this.shieldMesh);
    this.targetMarker=new THREE.Mesh(new THREE.SphereGeometry(.35,7,5),new THREE.MeshBasicMaterial({color}));this.targetMarker.visible=false;scene.add(this.root,this.targetMarker);
  }

  spawn(track:Track,index:number,lane=0){const s=track.sample(index);this.root.position.copy(s.position).addScaledVector(s.right,lane);this.root.position.y+=.04;this.heading=Math.atan2(s.tangent.x,s.tangent.z);this.root.rotation.y=this.heading;this.progress.trackIndex=index;this.lastValidIndex=index;this.velocity.set(0,0,0);this.speed=0;this.verticalVelocity=0;this.airTime=0;this.jumpCooldown=.5;this.grounded=true;}

  update(dt:number,input:InputState,track:Track,raceActive:boolean){
    if(this.progress.finished){this.speed=Math.max(0,this.speed-12*dt);input={throttle:0,steer:input.steer,drift:false}}
    if(this.stunTime>0){this.stunTime-=dt;input={throttle:0,steer:0,drift:false};this.speed*=Math.pow(.15,dt)}
    this.boostTime=Math.max(0,this.boostTime-dt);this.shieldTime=Math.max(0,this.shieldTime-dt);this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);if(this.grounded)this.airTime=0;else this.airTime+=dt;this.shieldMesh.visible=this.shieldTime>0;
    const forward=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading));
    const accel=this.boostTime>0?30:21;const top=this.maxSpeed*(this.boostTime>0?1.28:1);
    if(raceActive){if(input.throttle>0)this.speed+=accel*input.throttle*dt;else if(input.throttle<0){if(this.speed>1)this.speed-=34*dt;else this.speed=Math.max(-10,this.speed-13*dt)}else this.speed*=Math.pow(.82,dt);}
    else this.speed*=Math.pow(.05,dt);
    let idx=track.nearest(this.root.position,this.progress.trackIndex);let sample=track.sample(idx);let lateral=Math.abs(this.root.position.clone().sub(sample.position).dot(sample.right));const onRoad=lateral<TRACK_WIDTH/2+1.5;
    if(!onRoad){this.offTrackTime+=dt;this.speed*=Math.pow(.30,dt);this.speed=Math.min(this.speed,15)}else{this.offTrackTime=0;this.lastValidIndex=idx}
    this.speed=THREE.MathUtils.clamp(this.speed,-10,top);
    this.steerValue=THREE.MathUtils.lerp(this.steerValue,input.steer,1-Math.pow(.00004,dt));
    const steerPower=(1-Math.min(Math.abs(this.speed)/95,.25))*2.8;
    if(Math.abs(this.speed)>.4)this.heading+=this.steerValue*steerPower*dt*Math.sign(this.speed)*(input.drift?1.28:1);
    if(input.drift&&Math.abs(this.speed)>13&&Math.abs(input.steer)>.2){this.driftCharge=Math.min(1.6,this.driftCharge+dt);this.speed*=Math.pow(.91,dt);this.body.rotation.z=THREE.MathUtils.lerp(this.body.rotation.z,-input.steer*.14,.14)}else{
      if(this.driftCharge>.45)this.boostTime=Math.max(this.boostTime,.35+this.driftCharge*.65);this.driftCharge=0;this.body.rotation.z=THREE.MathUtils.lerp(this.body.rotation.z,0,.18);
    }
    const previousPosition=this.root.position.clone();
    const moveForward=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading));this.velocity.lerp(moveForward.multiplyScalar(this.speed),input.drift?.075:.2);
    this.root.position.addScaledVector(this.velocity,dt);
    idx=track.nearest(this.root.position,idx,14);sample=track.sample(idx);lateral=Math.abs(this.root.position.clone().sub(sample.position).dot(sample.right));const roadHeight=sample.position.y+.04;
    if(this.grounded&&this.jumpCooldown<=0&&idx>=track.jumpStart&&idx<=track.jumpStart+2&&this.speed>20){this.verticalVelocity=8.5;this.grounded=false;this.airTime=0;this.jumpCooldown=1.4}
    if(!this.grounded){this.verticalVelocity-=19*dt;this.root.position.y+=this.verticalVelocity*dt;if((this.verticalVelocity<=0&&this.root.position.y<=roadHeight)||this.airTime>2.2||this.root.position.y<roadHeight-1){this.root.position.y=roadHeight;this.verticalVelocity=0;this.airTime=0;this.grounded=true}}
    else this.root.position.y=roadHeight;
    const barrierLimit=TRACK_WIDTH/2-1.15;const signedLateral=this.root.position.clone().sub(sample.position).dot(sample.right);const currentLateral=Math.abs(signedLateral);
    if(currentLateral>barrierLimit){const side=Math.sign(signedLateral);const penetration=currentLateral-barrierLimit;this.root.position.addScaledVector(sample.right,-side*Math.min(penetration,2.5)*.72);const trackHeading=Math.atan2(sample.tangent.x,sample.tangent.z);const headingDelta=Math.atan2(Math.sin(trackHeading-this.heading),Math.cos(trackHeading-this.heading));this.heading+=headingDelta*Math.min(.42,.12+penetration*.08);this.speed=Math.max(3,this.speed*(.86-Math.min(.22,penetration*.06)));this.velocity.lerp(sample.tangent.clone().multiplyScalar(this.speed),.46)}
    for(const collider of track.colliders){const p=this.root.position;if(p.x>=collider.min.x-1.05&&p.x<=collider.max.x+1.05&&p.y>=collider.min.y-.5&&p.y<=collider.max.y+1.8&&p.z>=collider.min.z-1.05&&p.z<=collider.max.z+1.05){this.root.position.copy(previousPosition);const trackHeading=Math.atan2(sample.tangent.x,sample.tangent.z);this.heading=THREE.MathUtils.lerp(this.heading,trackHeading,.35);this.speed=Math.max(-2,this.speed*.18);this.velocity.multiplyScalar(-.1);break}}
    this.root.rotation.y=this.heading;for(const w of this.wheels)w.rotation.x-=this.speed*dt/.43;
    if(!Number.isFinite(this.root.position.x+this.root.position.y+this.root.position.z)||this.offTrackTime>4)this.respawn(track);
    this.updateProgress(track,idx);
  }

  private updateProgress(track:Track,idx:number){
    const old=this.progress.trackIndex;let delta=idx-old;if(delta>SAMPLE_COUNT/2)delta-=SAMPLE_COUNT;if(delta<-SAMPLE_COUNT/2)delta+=SAMPLE_COUNT;
    if(Math.abs(delta)<45){this.progress.trackIndex=idx;this.progress.totalProgress+=delta}
    const waitingForFinish=this.progress.checkpoint>=CHECKPOINT_COUNT;const nextCheckpoint=waitingForFinish?track.checkpoints[0]:track.checkpoints[this.progress.checkpoint];const cpDelta=Math.abs(((idx-nextCheckpoint+SAMPLE_COUNT/2)%SAMPLE_COUNT)-SAMPLE_COUNT/2);
    if(delta>0&&cpDelta<5){if(waitingForFinish){this.progress.checkpoint=1;this.progress.lap++}else this.progress.checkpoint++}
  }

  respawn(track:Track){let best=track.resetIndices[0];for(const ri of track.resetIndices){const d=(this.lastValidIndex-ri+SAMPLE_COUNT)%SAMPLE_COUNT;if(d>=0&&d<30){best=ri;break}}this.spawn(track,best,0);this.speed=5;this.offTrackTime=0;this.botState='race';this.stateTime=0;this.recoveryAttempts=0}
  hit(){if(this.shieldTime>0){this.shieldTime=0;return false}this.stunTime=1.15;this.speed*=.35;return true}
  dispose(){this.root.removeFromParent();this.targetMarker.removeFromParent()}
}
