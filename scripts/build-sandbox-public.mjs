import { copyFile,mkdir } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const target=new URL('.sandbox-dist/',root);
const sandbox=['game.mjs','index.html','landmarks.glb','look.mjs','style.css','utility.ev.glb','world.mjs','LICENSE-VEHICLE.txt'];
const shared=['campus.json','campus-look.mjs','render.mjs','world.mjs'];
const vendor=[
  ['build/three.module.js','vendor/three.module.js'],
  ['build/three.core.js','vendor/three.core.js'],
  ['examples/jsm/objects/Reflector.js','vendor/Reflector.js'],
  ['examples/jsm/loaders/GLTFLoader.js','vendor/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js','utils/BufferGeometryUtils.js'],
  ['LICENSE','vendor/LICENSE.txt'],
];
const pairs=[
  ...sandbox.map(f=>['public/gaoxin-sandbox/'+f,'gaoxin-sandbox/'+f]),
  ...shared.map(f=>['public/gaoxin-3d/'+f,'gaoxin-3d/'+f]),
  ...vendor.map(([src,dst])=>['node_modules/three/'+src,'gaoxin-3d/'+dst]),
];
await Promise.all(pairs.map(async ([src,dst])=>{
  const path=new URL(dst,target);
  await mkdir(new URL('./',path),{recursive:true});
  await copyFile(new URL(src,root),path);
}));
console.log('Prepared '+pairs.length+' public game assets.');
