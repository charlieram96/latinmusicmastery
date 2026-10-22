const fs=require('node:fs'),{get}=require('@tonaljs/note');
function writeWave(file,events,length){
 const rate=24000,count=Math.ceil(length*rate),signal=new Float64Array(count);
 for(const e of events){const note=get(e.soundPitch||e.pitch);if(note.empty||note.freq===null)throw new Error(`Invalid pitch ${e.pitch}`);
  const start=Math.round(e.start*rate),samples=Math.round(e.duration*rate);
  for(let i=0;i<samples&&start+i<count;i++){const t=i/rate,env=Math.min(1,t/.008)*Math.min(1,(e.duration-t)/.06)*Math.exp(-1.4*t/Math.max(.5,e.duration));signal[start+i]+=(e.gain??.17)*env*(Math.sin(2*Math.PI*note.freq*t)+.28*Math.sin(4*Math.PI*note.freq*t)+.1*Math.sin(6*Math.PI*note.freq*t));}
 }
 const buf=Buffer.alloc(44+count*2);buf.write('RIFF');buf.writeUInt32LE(36+count*2,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(rate,24);buf.writeUInt32LE(rate*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++)buf.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,signal[i]))*32767),44+i*2);fs.writeFileSync(file,buf);
}
module.exports={writeWave};
