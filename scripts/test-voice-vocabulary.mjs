import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const python=path.join(root,'.venv-voice',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const result=spawnSync(python,['-m','unittest','discover','-s','tests','-p','test_order_vocabulary.py'],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
