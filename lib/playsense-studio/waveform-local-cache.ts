/** Persistent fallback when Storage is unavailable; keyed by owner and media. */
export function localWaveformCache(path: string, value?: string): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    let db: IDBDatabase | undefined;
    let done=false;
    const finish=(result:string|null)=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(result);};
    const timer=setTimeout(()=>finish(null),2000);
    try {
      const open=indexedDB.open('lmm-waveforms',1);
      open.onupgradeneeded=()=>{open.result.createObjectStore('peaks');};
      open.onerror=()=>finish(null);
      open.onblocked=()=>finish(null);
      open.onsuccess=()=>{
        db=open.result;
        if(done){db.close();return;}
        try {
          const tx=db.transaction('peaks',value === undefined ? 'readonly':'readwrite');
          const store=tx.objectStore('peaks');
          const req=value === undefined ? store.get(path):store.put(value,path);
          let result:string|null=null;
          req.onsuccess=()=>{result=value ?? (typeof req.result==='string' ? req.result:null);};
          tx.oncomplete=()=>finish(result);
          tx.onerror=()=>finish(null);tx.onabort=()=>finish(null);
        }catch{finish(null);}
      };
    } catch {finish(null);}
  });
}
