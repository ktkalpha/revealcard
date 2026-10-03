import {execFileSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(fileURLToPath(new URL('.',import.meta.url)))
const agents=resolve(homedir(),'Library/LaunchAgents'),logs=resolve(root,'logs')
await mkdir(agents,{recursive:true});await mkdir(logs,{recursive:true,mode:0o700})
const label='me.kobyte01.revealcard-pet-worker'
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const file=resolve(agents,label+'.plist')
await writeFile(file,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(resolve(root,'pet-worker.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(resolve(logs,'worker.log'))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(logs,'worker-error.log'))}</string>
</dict></plist>`,{mode:0o600})
const domain=`gui/${process.getuid()}`
try{execFileSync('/bin/launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'})}catch{}
execFileSync('/bin/launchctl',['bootstrap',domain,file],{stdio:'inherit'})
console.log(`Installed ${file}`)
