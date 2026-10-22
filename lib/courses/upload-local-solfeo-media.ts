export async function uploadLocalSolfeoMedia(itemId:string,file:File):Promise<string>{
 const form=new FormData();form.set('itemId',itemId);form.set('file',file)
 const response=await fetch('/api/local-solfeo-media',{method:'POST',body:form})
 const result=await response.json()
 if(!response.ok||!result.url)throw new Error(result.error||'Could not save local file')
 return result.url
}
