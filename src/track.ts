import * as THREE from 'three';
import type { TrackSample } from './types';

export const TRACK_WIDTH = 16;
export const SAMPLE_COUNT = 720;
export const CHECKPOINT_COUNT = 16;

const controlPoints = [
  [-55, 0, -92], [0, 0, -92], [62, 1, -92], [112, 3, -80],
  [142, 7, -48], [148, 11, -4], [142, 15, 45], [118, 19, 82],
  [78, 21, 103], [34, 20, 105], [0, 17, 88], [-18, 14, 61],
  [-2, 11, 37], [38, 9, 29], [79, 7, 17], [96, 4, -7],
  [83, 1, -31], [48, -2, -43], [5, -3, -40], [-37, -3, -18],
  [-78, -1, 13], [-122, 1, 15], [-151, 4, -10], [-157, 7, -48],
  [-137, 9, -79], [-102, 7, -92]
].map(([x,y,z]) => new THREE.Vector3(x,y,z));

export class Track {
  readonly curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.28);
  readonly samples: TrackSample[] = [];
  readonly checkpoints: number[] = [];
  readonly resetIndices: number[] = [];
  readonly group = new THREE.Group();
  readonly debug = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];
  readonly decorationBounds: THREE.Box3[] = [];
  readonly jumpStart = 93;
  readonly jumpEnd = 108;
  totalLength = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Skyline Circuit';
    this.createSamples();
    this.createRoad();
    this.createBarriers();
    this.createStartArea();
    this.createTunnel();
    this.createWorld();
    this.createDebug();
    scene.add(this.group, this.debug);
    this.debug.visible = false;
  }

  private createSamples() {
    let distance = 0;
    let previous = this.curve.getPointAt(0);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const u = i / SAMPLE_COUNT;
      const position = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      if (i) distance += position.distanceTo(previous);
      this.samples.push({ position, tangent, right, width: TRACK_WIDTH, distance, index: i });
      previous = position;
    }
    this.totalLength = distance + previous.distanceTo(this.samples[0].position);
    for (let i = 0; i < CHECKPOINT_COUNT; i++) this.checkpoints.push(Math.floor(i * SAMPLE_COUNT / CHECKPOINT_COUNT));
    for (let i = 0; i < SAMPLE_COUNT; i += 26) this.resetIndices.push(i);
  }

  private ribbon(width: number, yOffset: number, material: THREE.Material, start = 0, end = SAMPLE_COUNT, close = true) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const count = end - start + (close ? 1 : 0);
    for (let n = 0; n < count; n++) {
      const i = (start + n) % SAMPLE_COUNT;
      const s = this.samples[i];
      const left = s.position.clone().addScaledVector(s.right, -width / 2); left.y += yOffset;
      const right = s.position.clone().addScaledVector(s.right, width / 2); right.y += yOffset;
      pos.push(left.x,left.y,left.z,right.x,right.y,right.z);
      uv.push(0,n/7,1,n/7);
      if (n < count - 1) { const a=n*2; idx.push(a,a+2,a+1,a+1,a+2,a+3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g,material); mesh.receiveShadow=true; this.group.add(mesh); return mesh;
  }

  private createRoad() {
    const shoulder = new THREE.MeshStandardMaterial({color:0x17374a,roughness:.9});
    const asphalt = new THREE.MeshStandardMaterial({color:0x25313a,roughness:.78,metalness:.05});
    this.ribbon(TRACK_WIDTH+5,-.16,shoulder);
    this.ribbon(TRACK_WIDTH,0,asphalt);
    const marking = new THREE.MeshStandardMaterial({color:0x70ffe7,emissive:0x123f3a,roughness:.5});
    for(let i=0;i<SAMPLE_COUNT;i+=13){
      const s=this.samples[i]; const m=new THREE.Mesh(new THREE.BoxGeometry(.18,.025,2.4),marking);
      m.position.copy(s.position).add(new THREE.Vector3(0,.08,0)); m.rotation.y=Math.atan2(s.tangent.x,s.tangent.z); this.group.add(m);
    }
    const ground=new THREE.Mesh(new THREE.CircleGeometry(205,64),new THREE.MeshStandardMaterial({color:0x173632,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-4.2;ground.receiveShadow=true;this.group.add(ground);
  }

  private createBarriers() {
    const red=new THREE.MeshStandardMaterial({color:0xff4b56,roughness:.55});
    const white=new THREE.MeshStandardMaterial({color:0xe8f2ef,roughness:.7});
    for(let i=0;i<SAMPLE_COUNT;i+=5){
      const s=this.samples[i];
      for(const side of [-1,1]){
        const b=new THREE.Mesh(new THREE.BoxGeometry(.32,.72,2.1),(Math.floor(i/5)+side)%2?red:white);
        b.position.copy(s.position).addScaledVector(s.right,side*(TRACK_WIDTH/2+.45)); b.position.y+=.35;
        b.rotation.y=Math.atan2(s.tangent.x,s.tangent.z); b.castShadow=true; this.group.add(b);
      }
    }
  }

  private createStartArea(){
    const s=this.samples[0];
    const line=new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH,.04,1.3),new THREE.MeshStandardMaterial({color:0xf4f4f4}));
    line.position.copy(s.position);line.position.y+=.07;line.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);this.group.add(line);
    const postMat=new THREE.MeshStandardMaterial({color:0x102836,metalness:.6});
    for(const side of [-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.7,7,.7),postMat);p.position.copy(s.position).addScaledVector(s.right,side*(TRACK_WIDTH/2+2));p.position.y+=3.5;this.group.add(p)}
    const arch=new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH+5,.8,.8),postMat);arch.position.copy(s.position);arch.position.y+=6.7;arch.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);this.group.add(arch);
    const sign=this.makeSign('NEON APEX',0x45f5d3);sign.position.copy(s.position);sign.position.y+=6.65;sign.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);this.group.add(sign);
    for(let row=0;row<3;row++)for(const side of [-1,1]){const grand=new THREE.Mesh(new THREE.BoxGeometry(15,2.4,5),new THREE.MeshStandardMaterial({color:0x244353}));grand.position.copy(s.position).addScaledVector(s.right,side*(15+row*7)).addScaledVector(s.tangent,12);grand.position.y+=1.2;grand.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);grand.updateMatrixWorld(true);this.colliders.push(new THREE.Box3().setFromObject(grand));this.group.add(grand);this.addCrowd(grand.position,side)}
  }

  private makeSign(text:string,color:number){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d')!;c.fillStyle='#07131f';c.fillRect(0,0,512,96);c.strokeStyle=`#${color.toString(16).padStart(6,'0')}`;c.lineWidth=7;c.strokeRect(4,4,504,88);c.fillStyle='#fff';c.font='bold 46px sans-serif';c.textAlign='center';c.fillText(text,256,64);
    return new THREE.Mesh(new THREE.PlaneGeometry(8,1.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));
  }

  private createTunnel(){
    const mat=new THREE.MeshStandardMaterial({color:0x314856,roughness:.85,side:THREE.DoubleSide});
    for(let i=486;i<526;i+=3){const s=this.samples[i];const roof=new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH+3,.6,3),mat);roof.position.copy(s.position);roof.position.y+=6.4;roof.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);this.group.add(roof);for(const side of [-1,1]){const wall=new THREE.Mesh(new THREE.BoxGeometry(.7,6.4,3),mat);wall.position.copy(s.position).addScaledVector(s.right,side*(TRACK_WIDTH/2+1.2));wall.position.y+=3.1;wall.rotation.y=roof.rotation.y;this.group.add(wall)}}
  }

  private addCrowd(center:THREE.Vector3,side:number){
    const colors=[0xff5b64,0x52e7ff,0xffd052,0x9c7cff];
    for(let i=0;i<25;i++){const p=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,0),new THREE.MeshBasicMaterial({color:colors[i%4]}));p.position.copy(center).add(new THREE.Vector3((Math.random()-.5)*12,1.5+Math.random()*2,(Math.random()-.5)*3));p.position.x+=side*.2;this.group.add(p)}
  }

  private safeDecoration(position:THREE.Vector3,radius:number,large:boolean){
    const box=new THREE.Box3(new THREE.Vector3(position.x-radius,position.y,position.z-radius),new THREE.Vector3(position.x+radius,position.y+radius*3,position.z+radius));
    const margin=large?4:1.5;
    for(let i=0;i<SAMPLE_COUNT;i+=3){const s=this.samples[i];if(box.distanceToPoint(s.position)<TRACK_WIDTH/2+margin)return false}
    if(this.decorationBounds.some(b=>b.intersectsBox(box)))return false;this.decorationBounds.push(box);if(large)this.colliders.push(box.clone());return true;
  }

  private createWorld(){
    const rand=this.rng(94821);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(420,88),new THREE.MeshStandardMaterial({color:0x176078,roughness:.28,metalness:.18,transparent:true,opacity:.92}));water.rotation.x=-Math.PI/2;water.position.set(5,-3.85,157);this.group.add(water);
    const quay=new THREE.Mesh(new THREE.BoxGeometry(350,1.2,18),new THREE.MeshStandardMaterial({color:0x53636a,roughness:.92}));quay.position.set(0,-3.35,116);this.group.add(quay);

    const treeMat=new THREE.MeshStandardMaterial({color:0x1f7254});const treeMat2=new THREE.MeshStandardMaterial({color:0x2c8a61});const trunkMat=new THREE.MeshStandardMaterial({color:0x6d4b35});
    for(let i=0;i<230;i++){const angle=rand()*Math.PI*2,r=35+rand()*155;const p=new THREE.Vector3(Math.cos(angle)*r,-4,Math.sin(angle)*r);if(p.z>112)continue;if(!this.safeDecoration(p,1.15,true))continue;const tree=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.25,.38,2.5,6),trunkMat);trunk.position.y=1.25;const crown=new THREE.Mesh(new THREE.ConeGeometry(1.7+rand(),4+rand()*2,7),i%2?treeMat:treeMat2);crown.position.y=4;tree.add(trunk,crown);tree.position.copy(p);tree.scale.setScalar(.75+rand()*.5);this.group.add(tree)}

    const buildingMats=[0x18384a,0x244b57,0x3c3855,0x27465e].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.82}));
    for(let i=0;i<62;i++){const angle=rand()*Math.PI*2,r=45+rand()*145;const p=new THREE.Vector3(Math.cos(angle)*r,-4,Math.sin(angle)*r);if(p.z>110)continue;const radius=3+rand()*5;if(!this.safeDecoration(p,radius,true))continue;const h=8+rand()*25;const b=new THREE.Mesh(new THREE.BoxGeometry(radius*1.5,h,radius*1.5),buildingMats[i%4]);b.position.copy(p);b.position.y+=h/2;b.castShadow=true;this.group.add(b);for(let y=2;y<h-1;y+=3){const light=new THREE.Mesh(new THREE.BoxGeometry(radius*1.53,.55,.08),new THREE.MeshBasicMaterial({color:i%3?0x56cfd2:0xffc857}));light.position.copy(b.position).add(new THREE.Vector3(0,y-h/2,radius*.76));this.group.add(light)}}

    const containerColors=[0x17a6a0,0xe45b52,0xe7ad3d,0x365f91];
    for(let i=0;i<54;i++){const x=-165+(i%18)*19+(rand()-.5)*4,z=126+Math.floor(i/18)*12;const p=new THREE.Vector3(x,-4,z);if(!this.safeDecoration(p,4.8,true))continue;const stack=1+Math.floor(rand()*3);for(let level=0;level<stack;level++){const box=new THREE.Mesh(new THREE.BoxGeometry(8.5,2.6,3.5),new THREE.MeshStandardMaterial({color:containerColors[(i+level)%containerColors.length],roughness:.72,metalness:.15}));box.position.set(p.x,p.y+1.3+level*2.65,p.z);box.castShadow=true;this.group.add(box)}}

    const craneMat=new THREE.MeshStandardMaterial({color:0xf3b43d,roughness:.58,metalness:.32});
    for(const x of [-125,-45,45,125]){const p=new THREE.Vector3(x,-4,146);if(!this.safeDecoration(p,5.5,true))continue;const crane=new THREE.Group();const tower=new THREE.Mesh(new THREE.BoxGeometry(2.4,28,2.4),craneMat);tower.position.y=14;const arm=new THREE.Mesh(new THREE.BoxGeometry(28,1.2,1.2),craneMat);arm.position.set(8,27,0);const cable=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,12,6),new THREE.MeshStandardMaterial({color:0x18232b}));cable.position.set(17,20.5,0);crane.add(tower,arm,cable);crane.position.copy(p);this.group.add(crane)}

    for(let i=0;i<52;i++){const angle=rand()*Math.PI*2,r=35+rand()*150;const p=new THREE.Vector3(Math.cos(angle)*r,-3.5,Math.sin(angle)*r);if(p.z>110||!this.safeDecoration(p,2,true))continue;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(2+rand()*3,0),new THREE.MeshStandardMaterial({color:0x526261,roughness:1}));rock.position.copy(p);rock.scale.y=.6+rand();rock.rotation.set(rand(),rand(),rand());this.group.add(rock)}

    for(let i=0;i<12;i++){const s=this.samples[(i*57+34)%SAMPLE_COUNT];const pos=s.position.clone().addScaledVector(s.right,(i%2?1:-1)*14);if(!this.safeDecoration(pos,2.5,true))continue;const sign=this.makeSign(['VOLT PORT','NOVA DOCKS','GRIP','FLUX'][i%4],i%2?0xffc84a:0x45f5d3);sign.position.copy(pos);sign.position.y+=3.2;sign.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);this.group.add(sign)}

    const lampMat=new THREE.MeshStandardMaterial({color:0x1b303d,metalness:.65});
    for(let i=18;i<SAMPLE_COUNT;i+=24){const s=this.samples[i];if(s.position.y>1.5)continue;for(const side of [-1,1]){const p=s.position.clone().addScaledVector(s.right,side*(TRACK_WIDTH/2+4));p.y=-4;if(!this.safeDecoration(p,.7,false))continue;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,6,7),lampMat);pole.position.copy(p);pole.position.y+=3;const lamp=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),new THREE.MeshBasicMaterial({color:0x8effe8}));lamp.position.copy(p);lamp.position.y+=6;this.group.add(pole,lamp)}}

    const supportMat=new THREE.MeshStandardMaterial({color:0x344d58,roughness:.88});
    for(let i=0;i<SAMPLE_COUNT;i+=18){const s=this.samples[i];if(s.position.y<4.5)continue;for(const side of [-1,1]){const h=s.position.y+4;const support=new THREE.Mesh(new THREE.CylinderGeometry(.65,.9,h,8),supportMat);support.position.copy(s.position).addScaledVector(s.right,side*5.6);support.position.y=s.position.y-h/2-.25;this.group.add(support)}}

    const warehouseMat=new THREE.MeshStandardMaterial({color:0x2d4a56,roughness:.9});
    for(let i=0;i<10;i++){const p=new THREE.Vector3(-145+i*31,-4,104);if(!this.safeDecoration(p,7,true))continue;const house=new THREE.Mesh(new THREE.BoxGeometry(20,8,12),warehouseMat);house.position.copy(p);house.position.y+=4;const roof=new THREE.Mesh(new THREE.CylinderGeometry(7,7,20,3,1,false,0,Math.PI),new THREE.MeshStandardMaterial({color:0x172b35}));roof.rotation.z=Math.PI/2;roof.position.copy(p);roof.position.y+=8;this.group.add(house,roof)}
  }

  private createDebug(){
    const linePts=this.samples.map(s=>s.position.clone().add(new THREE.Vector3(0,.4,0)));linePts.push(linePts[0]);this.debug.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts),new THREE.LineBasicMaterial({color:0x00ff80})));
    for(const ci of this.checkpoints){const s=this.samples[ci];const g=new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH,.12,.35),new THREE.MeshBasicMaterial({color:0x00c8ff,transparent:true,opacity:.6}));g.position.copy(s.position);g.position.y+=.5;g.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);this.debug.add(g)}
    for(const ri of this.resetIndices){const s=this.samples[ri];const m=new THREE.Mesh(new THREE.ConeGeometry(.45,1,5),new THREE.MeshBasicMaterial({color:0xffea00}));m.position.copy(s.position);m.position.y+=1;this.debug.add(m)}
    const corridor=this.ribbon(TRACK_WIDTH+5,.1,new THREE.MeshBasicMaterial({color:0x00ff80,transparent:true,opacity:.12,depthWrite:false}));this.group.remove(corridor);this.debug.add(corridor);
  }

  nearest(position:THREE.Vector3,hint=0,range=70){let best=hint,bestD=Infinity;for(let d=-range;d<=range;d++){const i=(hint+d+SAMPLE_COUNT)%SAMPLE_COUNT;const s=this.samples[i];const dx=position.x-s.position.x,dy=position.y-s.position.y,dz=position.z-s.position.z;const ds=dx*dx+dz*dz+dy*dy*6;if(ds<bestD){bestD=ds;best=i}}return best}
  sample(index:number){return this.samples[(Math.round(index)+SAMPLE_COUNT)%SAMPLE_COUNT]}
  private rng(seed:number){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
}
