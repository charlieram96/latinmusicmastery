// Encode one audio stream from the original PCM scenes at absolute film times.
// Never concatenate separately encoded AAC streams: padding/gaps can accumulate.
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
function muxContinuousAudio(inputVideo,outputVideo,directory,chapters,{preferTempo=false}={}){
 const args=['-y','-v','error','-i',inputVideo];
 const filters=chapters.map((ch,i)=>{
  const prefix=directory+'/'+String(i).padStart(3,'0');
  const wave=preferTempo&&fs.existsSync(prefix+'-tempo.wav')?prefix+'-tempo.wav':prefix+'.wav';
  args.push('-i',wave);
  return `[${i+1}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${ch.end-ch.start},asetpts=PTS-STARTPTS,adelay=${Math.round(ch.start*48000)}S:all=1[a${i}]`;
 });
 filters.push(chapters.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${chapters.length}:duration=longest:normalize=0[audio]`);
 args.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[audio]','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',outputVideo);
 execFileSync('/Users/raffymac/bin/ffmpeg',args,{stdio:'pipe'});
}
module.exports={muxContinuousAudio};
