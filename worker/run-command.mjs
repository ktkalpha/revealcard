import { spawn } from 'node:child_process'
export function run(binary,args,{input='',timeout=60000,cwd,log,signal}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return}
    const child=spawn(binary,args,{cwd,detached:true,stdio:['pipe','pipe','pipe']})
    let stdout='',stderr='',stopReason,killTimer
    const kill=kind=>{try{process.kill(-child.pid,kind)}catch{child.kill(kind)}}
    const stop=reason=>{if(stopReason)return;stopReason=reason;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),5000)}
    const abort=()=>stop(signal.reason||Object.assign(Error('작업이 취소됐어요.'),{name:'AbortError'}))
    const timer=setTimeout(()=>stop(Error('Command timed out')),timeout)
    const cleanup=()=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort)}
    signal?.addEventListener('abort',abort,{once:true})
    child.stdout.on('data',part=>{stdout+=part;if(log)log(part)})
    child.stderr.on('data',part=>{stderr+=part})
    child.on('error',err=>{cleanup();reject(err)})
    child.on('close',code=>{cleanup();stopReason?reject(stopReason):code===0?resolve(stdout):reject(Error(stderr.slice(-1000)||`Command exited ${code}`))})
    child.stdin.on('error',()=>{})
    child.stdin.end(input)
  })
}
