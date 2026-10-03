// Called over the existing SSH connection, never exposed as an HTTP worker endpoint.
import { createPets } from './pets.js'
const [directory,command]=process.argv.slice(2)
if(!directory)throw Error('Pet directory required')
const pets=createPets(directory)
let result
if(command==='claim')result=await pets.claim()
else if(command==='heartbeat')result=await pets.heartbeat()
else {
  const chunks=[];let size=0
  for await(const part of process.stdin){size+=part.length;if(size>16*1024*1024)throw Error('Payload too large');chunks.push(part)}
  const input=JSON.parse(Buffer.concat(chunks))
  if(command==='finish')result=await pets.finish(input.id,input.claim,input.image)
  else if(command==='fail')result=await pets.fail(input.id,input.claim)
  else throw Error('Unknown command')
}
process.stdout.write(JSON.stringify(result))
