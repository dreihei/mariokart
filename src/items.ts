import * as THREE from 'three';
import type { ItemType } from './types';
import { SAMPLE_COUNT, Track } from './track';
import { Racer } from './racer';

export class ItemSystem {
  boxes:{mesh:THREE.Mesh,index:number,cooldown:number}[]=[];
  projectiles:{mesh:THREE.Mesh,owner:Racer,velocity:THREE.Vector3,life:number}[]=[];
  barriers:{mesh:THREE.Mesh,owner:Racer,life:number}[]=[];
  private itemTypes:ItemType[]=['boost','pulse','barrier','shield'];
  constructor(private scene:THREE.Scene,private track:Track){
    const mat=new THREE.MeshStandardMaterial({color:0x56fff0,emissive:0x146b65,metalness:.25,roughness:.25,transparent:true,opacity:.9});
    for(let i=24;i<SAMPLE_COUNT;i+=42)for(const lane of [-2.8,0,2.8]){const s=track.sample(i);const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(.72,0),mat.clone());mesh.position.copy(s.position).addScaledVector(s.right,lane);mesh.position.y+=1.15;mesh.castShadow=true;scene.add(mesh);this.boxes.push({mesh,index:i,cooldown:0})}
  }
  update(dt:number,racers:Racer[]){
    for(const b of this.boxes){b.cooldown=Math.max(0,b.cooldown-dt);b.mesh.visible=b.cooldown<=0;b.mesh.rotation.y+=dt*1.7;b.mesh.rotation.x+=dt*.6;if(b.cooldown<=0)for(const r of racers){if(!r.item&&r.root.position.distanceToSquared(b.mesh.position)<3.2){r.item=this.itemTypes[Math.floor(Math.random()*this.itemTypes.length)];b.cooldown=5;b.mesh.visible=false;break}}}
    for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i];p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=dt*9;p.mesh.rotation.z+=dt*5;const idx=this.track.nearest(p.mesh.position,p.owner.progress.trackIndex,120);const s=this.track.sample(idx);p.mesh.position.y=THREE.MathUtils.lerp(p.mesh.position.y,s.position.y+1,.15);for(const r of racers){if(r!==p.owner&&r.root.position.distanceToSquared(p.mesh.position)<4){r.hit();p.life=0;break}}if(p.life<=0){p.mesh.removeFromParent();this.projectiles.splice(i,1)}}
    for(let i=this.barriers.length-1;i>=0;i--){const b=this.barriers[i];b.life-=dt;b.mesh.rotation.y+=dt*.4;for(const r of racers){if(r!==b.owner&&r.root.position.distanceToSquared(b.mesh.position)<4){r.hit();b.life=0;break}}if(b.life<=0){b.mesh.removeFromParent();this.barriers.splice(i,1)}}
  }
  use(r:Racer){if(!r.item)return;const type=r.item;r.item=null;
    if(type==='boost')r.boostTime=Math.max(r.boostTime,2.1);
    if(type==='shield')r.shieldTime=6;
    if(type==='pulse'){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,1),new THREE.MeshStandardMaterial({color:0xffe65b,emissive:0xaa5b00}));mesh.position.copy(r.root.position).add(new THREE.Vector3(0,1,0));const v=new THREE.Vector3(Math.sin(r.heading),0,Math.cos(r.heading)).multiplyScalar(48);this.scene.add(mesh);this.projectiles.push({mesh,owner:r,velocity:v,life:5})}
    if(type==='barrier'){const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(1.05,0),new THREE.MeshStandardMaterial({color:0xff4e6a,roughness:.7}));mesh.position.copy(r.root.position).add(new THREE.Vector3(-Math.sin(r.heading)*3.5,.8,-Math.cos(r.heading)*3.5));mesh.castShadow=true;this.scene.add(mesh);this.barriers.push({mesh,owner:r,life:20})}
  }
  dispose(){for(const b of this.boxes)b.mesh.removeFromParent();for(const p of this.projectiles)p.mesh.removeFromParent();for(const b of this.barriers)b.mesh.removeFromParent()}
}
