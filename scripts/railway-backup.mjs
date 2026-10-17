import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,copyFileSync,mkdtempSync,unlinkSync,rmdirSync,constants,statSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {inspectDatabase} from './maintenance.mjs';
import {createStore} from '../server/store.mjs';

const MAX_BYTES=64*1024*1024;
const sha=data=>createHash('sha256').update(data).digest('hex');
function logicalHash(filename,shape){
  const db=new DatabaseSync(filename,{readOnly:true});
  try{
    db.exec('BEGIN');
    const quote=name=>'"'+name.replaceAll('"','""')+'"';
    const tables=shape||db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>({name,columns:db.prepare('PRAGMA table_info('+quote(name)+')').all().map(c=>c.name)}));
    // Additive migrations may create tables/default columns. Every original
    // column and row must still exist unchanged; missing columns fail closed.
    const rows=tables.map(({name,columns})=>[name,db.prepare('SELECT '+columns.map(quote).join(',')+' FROM '+quote(name)).all().map(r=>JSON.stringify(r)).sort()]);
    return {tables:tables.length,shape:tables,hash:sha(JSON.stringify(rows))};
  }finally{db.close();}
}
export function saveVerifiedBackup(payload,directory){
  if(payload?.kind!=='gerai-kita-sqlite-backup'||!Number.isSafeInteger(payload.bytes)||payload.bytes<1||payload.bytes>MAX_BYTES||
    typeof payload.base64!=='string'||payload.base64.length!==4*Math.ceil(payload.bytes/3)||! /^[a-f0-9]{64}$/.test(payload.sha256||''))throw Error('Invalid backup envelope.');
  const bytes=Buffer.from(payload.base64,'base64');
  if(bytes.length!==payload.bytes||bytes.toString('base64')!==payload.base64||sha(bytes)!==payload.sha256)throw Error('Backup checksum mismatch.');
  mkdirSync(directory,{recursive:true});
  const filename=path.join(directory,'railway-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.sqlite');
  const partial=filename+'.partial';
  let scratch;
  try{
    writeFileSync(partial,bytes,{flag:'wx',mode:0o600});
    const check=inspectDatabase(partial),before=logicalHash(partial);
    scratch=mkdtempSync(path.join(os.tmpdir(),'gerai-backup-restore-'));
    const restored=path.join(scratch,'restored.sqlite');
    copyFileSync(partial,restored,constants.COPYFILE_EXCL);
    // Open the restored copy with the real store/migrations, then compare every row.
    const store=createStore(restored);store.close();
    inspectDatabase(restored);
    const after=logicalHash(restored,before.shape);
    if(after.hash!==before.hash||after.tables!==before.tables)throw Error('Restored rows differ from backup.');
    renameSync(partial,filename);
    const report={checkedAt:new Date().toISOString(),filename,bytes:bytes.length,sha256:payload.sha256,
      integrity:check.integrity,foreignKeys:check.foreignKeys,restore:{applicationStoreOpened:true,tablesCompared:before.tables,allRowsEqual:true},
      productionRestorePerformed:false};
    writeFileSync(filename+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
    return report;
  }finally{
    try{unlinkSync(partial);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(scratch){
      for(const suffix of ['','-wal','-shm'])try{unlinkSync(path.join(scratch,'restored.sqlite')+suffix);}catch(error){if(error.code!=='ENOENT')throw error;}
      rmdirSync(scratch);
    }
  }
}

function run(cli,args,{input,maxBuffer=2*1024*1024}={}){
  const result=spawnSync(cli,args,{input,encoding:'utf8',timeout:180000,maxBuffer,windowsHide:true});
  if(result.error||result.status!==0)throw Error('Railway '+args[0]+' failed; check login, SSH access and network.');
  try{return JSON.parse(result.stdout.trim());}catch{throw Error('Railway returned an invalid response.');}
}
export function downloadRailwayBackup(config){
  const {cli,projectId,environmentId,serviceId,expectedAccount,identityFile,remoteDatabase,directory}=config;
  for(const id of [projectId,environmentId,serviceId])if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('Invalid resource ID.');
  for(const filename of [cli,identityFile,directory])if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('CLI, identity and output directory must use absolute paths.');
  if(!statSync(cli).isFile()||!statSync(identityFile).isFile())throw Error('CLI or SSH identity is missing.');
  if(typeof expectedAccount!=='string'||!expectedAccount.includes('@')||!/^\/[a-zA-Z0-9_./-]+\.sqlite$/.test(remoteDatabase||''))throw Error('Account/database configuration is missing.');
  const identity=run(cli,['whoami','--json']);
  if(identity.email!==expectedAccount)throw Error('Railway account differs from the configured backup owner.');
  const query='query($p:String!,$s:String!,$e:String!){project(id:$p){services{edges{node{id}}} environments{edges{node{id}}}} serviceInstance(serviceId:$s,environmentId:$e){activeDeployments{id status instances{id status}}}}';
  const inventory=run(cli,['api',query,'--raw-var','p='+projectId,'--raw-var','s='+serviceId,'--raw-var','e='+environmentId,'--compact']);
  if(!inventory.data?.project?.services.edges.some(x=>x.node.id===serviceId)||!inventory.data.project.environments.edges.some(x=>x.node.id===environmentId))throw Error('Service/environment is outside the configured project.');
  const active=inventory.data.serviceInstance?.activeDeployments.find(d=>d.status==='SUCCESS'&&d.instances.some(i=>i.status==='RUNNING'));
  const instance=active?.instances.find(i=>i.status==='RUNNING');
  if(!instance)throw Error('No successful running deployment is available.');
  const source=`
import {backupDatabase} from './scripts/maintenance.mjs';
import {validateRailwayStorage} from './server/deployment.mjs';
import {readFileSync,mkdtempSync,unlinkSync,rmdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';import os from 'node:os';import path from 'node:path';
validateRailwayStorage();
if(process.env.DATABASE_PATH!==${JSON.stringify(remoteDatabase)})throw Error('Database configuration differs.');
const directory=mkdtempSync(path.join(os.tmpdir(),'gerai-export-'));let backup;
try{
 backup=backupDatabase(process.env.DATABASE_PATH,directory);
 if(statSync(backup.filename).size>${MAX_BYTES})throw Error('Backup exceeds transport limit.');
 const bytes=readFileSync(backup.filename);
 process.stdout.write(JSON.stringify({kind:'gerai-kita-sqlite-backup',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')}));
}finally{if(backup)unlinkSync(backup.filename);rmdirSync(directory);}
`;
  const payload=run(cli,['ssh','--project',projectId,'--environment',environmentId,'--service',serviceId,'--deployment-instance',instance.id,
    '--identity-file',identityFile,'--','node','--input-type=module','-'],{input:source,maxBuffer:Math.ceil(MAX_BYTES*4/3)+1024*1024});
  return {...saveVerifiedBackup(payload,directory),projectId,environmentId,serviceId,deploymentId:active.id};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const {values}=parseArgs({options:{config:{type:'string'},help:{type:'boolean'}}});
    if(values.help)console.log('node scripts/railway-backup.mjs --config LOCAL_CONFIG.json\nDownloads a consistent SQLite snapshot over SSH and verifies an isolated application restore. No production restore or retention deletion.');
    else{
      if(!values.config)throw Error('Supply --config with a local backup configuration.');
      console.log(JSON.stringify(downloadRailwayBackup(JSON.parse(readFileSync(values.config,'utf8'))),null,2));
    }
  }catch(error){console.error('Backup failed: '+error.message);process.exitCode=1;}
}
