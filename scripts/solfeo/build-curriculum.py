"""Recover authored source topics into a complete, auditable local lesson catalogue.
Does not change live course items or mark unproduced media as complete.
"""
from pathlib import Path
import json, re, collections, hashlib
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'output/pdf/solfeo-aplicado-ampliado-fuentes'
OUT=ROOT/'local-artifacts/solfeo-course/production'
OUT.mkdir(parents=True,exist_ok=True)
MAP={
1:['nomenclatura','pentagrama','sol','adicionales','figuras','relaciones','partes','taller-1'],
2:['pulso','compas','silencio-compas figuras-silencios-equivalencias figuras-silencios-conteo','unidades unidades-cuadro','compas-blanca-2 compas-blanca-3 compas-blanca-4','compasillo-partido','marcar-2 marcar-3 marcar-4','lectura-inicial-1 lectura-inicial-2 lectura-inicial-3 lectura-inicial-6 redondas combinaciones','lectura-inicial-4 lectura-inicial-5','formulas-I-0 formulas-I-1 formulas-I-2','formulas-II-0 formulas-II-1 formulas-II-2','formulas-III-0 formulas-III-1 formulas-III-2','formula-melodica-4 formula-melodica-3 reduccion-proporcional'],
3:['tonos','alteraciones','accidental-alcance','enarmonia-ejemplos','teclado-enarmonico','intervalo '+' '.join(f'atlas-intervalos-{i}' for i in range(7)),'intervalos-0 segundas-control-0 segundas-control-1','intervalos-1 terceras-control terceras-grados terceras-alteradas','intervalos-2 intervalo-preparado-4','intervalos-3 intervalo-preparado-5','intervalos-4 intervalo-preparado-6','intervalos-5 intervalo-preparado-7 intervalo-preparado-8','intervalos-simultaneos-0 melodico-armonico-un-pentagrama consonancia-contexto','intervalos-inversion-completos intervalos-simultaneos-1','taller-3-a taller-3-b'],
4:['corcheas semicorcheas-progresivas','figuras','puntillos','triple-puntillo doble-puntillo-ejemplos doble-puntillo-fa','sincopa sincopas-niveles','anacrusa-documentada','compuestos','compuesto-practica-3-8 compuesto-practica-6-4 compuesto-practica-9-8 compuesto-practica-12-8','asimetricos','irregulares-0 tresillos-variados-0 tresillos-variados-1 tresillos-variados-2','irregulares-1 seisillo-valores-0 seisillo-valores-1','seisillo-agrupacion seisillos-aplicados','irregulares-2','taller-4-a taller-4-b'],
5:['escala','armaduras','orden-sostenidos orden-sostenidos-detalle-2','orden-bemoles orden-bemoles-detalle-2','menor','menor menor-natural-lectura','acordes','acordes'],
6:['estudio-tonal']+[' '.join(f'tonal-{i}-{suffix}' for suffix in ['mayor','mayor-detalle-2','menor','desc']) for i in range(15)],
7:['cromatica','accidental-alcance','enarmonia-ejemplos','alteraciones-entonadas-0 alteraciones-entonadas-1 alteraciones-entonadas-2 consolidacion','modulacion-concepto centros-tonales','modulacion-concepto','modulacion-practica'],
8:['dinamica','dinamica','articulacion fraseo','acentos','agogica-vocabulario','agogica-vocabulario','agogica-cambios','agogica fraseo','adornos apoyaturas adornos-realizados glissando octavas'],
9:['barras','casillas-tres','saltos','saltos','saltos-2','taller-9-a taller-9-b saltos-2'],
10:['fa fa-mapa-ampliado fa-estudio-1 fa-estudio-2 fa-estudio-3','do do-primera','teclado sistema','dos-voces independencia-0 independencia-1 lectura-conjunto-indicaciones','lectura-conjunta-retornos-1 lectura-conjunta-retornos-2 lectura-conjunta-retornos-3','danza-conjunto-1 danza-conjunto-2 danza-conjunto-3 danza-conjunto-4'],
11:[f'repertorio-{i:02}' for i in range(1,41)],
12:['dictado-procedimiento']+[f'dictado-modelo-{i}' for i in range(1,7)]+['taller-10-a taller-10-b']}
source=json.loads((SOURCE/'content.es.json').read_text())
structure=json.loads((ROOT/'local-artifacts/solfeo-course/structure.json').read_text())
topics=collections.defaultdict(list)
for page in source['pages']:
 for block in page.get('blocks',[]):
  key=block.get('_sourcePage',page['id'])
  topics[key].append({**block,'sourcePageId':page['id']})
# Export from recovered topic blocks, not physical PDF pages: pagination can
# combine unrelated topics and must never attach a neighbouring score to a class.
export_script=(SOURCE/'export_scores.py').read_text()
export_script=export_script.replace("OUT=ROOT/'scores'", "OUT=Path("+repr(str(OUT/'scores'))+")")
export_script=export_script.replace("DATA=json.loads((ROOT/'content.es.json').read_text())", "DATA=RECOVERED_DATA")
recovered={'pages':[{'id':key,'title':key,'blocks':blocks} for key,blocks in topics.items() if not key.startswith(('toc-', 'flow-'))]}
exec(compile(export_script,str(SOURCE/'export_scores.py'),'exec'), {'__file__':str(SOURCE/'export_scores.py'),'RECOVERED_DATA':recovered})
overrides=json.loads((ROOT/'scripts/solfeo/editorial-overrides.json').read_text())
lessons=[]
for m,section in enumerate(structure['sections'],1):
 assert len(MAP[m])==len(section['classes']),m
 for n,cls in enumerate(section['classes'],1):
  keys=MAP[m][n-1].split()
  if m==11 and keys[0]+'-2' in topics:keys.append(keys[0]+'-2')
  missing=[key for key in keys if not topics[key]]
  assert not missing,(m,n,missing)
  blocks=[b for k in keys for b in topics[k] if b['type']!='topic']
  override=overrides.get(cls['id'])
  if override:
   diagrams=[dict(b) for b in blocks if b['type']=='diagram']
   if override.get('navigationMode'):
    diagrams=[dict(next(b for b in diagrams if b['kind']=='navigation'),mode=override['navigationMode'])]
   for b in diagrams:
    if b.get('kind')=='score' and ('rowTitleInclude' in override or 'rowTitleExclude' in override):
     indices=[i for i,r in enumerate(b['rows']) if (not override.get('rowTitleInclude') or override['rowTitleInclude'] in r.get('title','')) and (not override.get('rowTitleExclude') or override['rowTitleExclude'] not in r.get('title',''))]
     heights=b.get('rowHeights',[b.get('rowHeight',120)]*len(b['rows']))
     b['rows']=[b['rows'][i] for i in indices];b['rowHeights']=[heights[i] for i in indices];b['height']=sum(b['rowHeights'])
   blocks=[{'type':'p','text':text,'_sourcePage':keys[0],'sourcePageId':'editorial-overrides'} for text in override['explanations']]+diagrams
  scores=[]
  for key in keys:
   for path in sorted((OUT/'scores').glob(key+'-*.json')):
    # Do not accidentally include another topic that shares a prefix.
    if re.fullmatch(re.escape(key)+r'-\d+\.json',path.name):
     score=json.loads(path.read_text())
     if override and override.get('rowTitleInclude') and override['rowTitleInclude'] not in score['title']['es']:continue
     if override and override.get('rowTitleExclude') and override['rowTitleExclude'] in score['title']['es']:continue
     scores.append({'id':path.stem,'source':str(path.relative_to(ROOT)),'musicxml':str(path.with_suffix('.musicxml').relative_to(ROOT)),'score':score})
  lessons.append({'id':cls['id'],'module':m,'number':n,'title':{'es':cls['title_es'],'en':cls['title']},'sourceTopics':keys,'editorialExercise':override.get('question') if override else None,'blocks':blocks,'scores':scores,'status':{'authoredSource':True,'videoVerified':m==1 and n<=2,'exerciseVerified':m==1 and n<=2,'studentVerified':m==1 and n<=2},'sourceHash':hashlib.sha256(json.dumps(blocks,sort_keys=True).encode()).hexdigest()})
catalog={'version':1,'scope':'localhost-only','lessons':lessons}
(OUT/'curriculum.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
report={'modules':len(structure['sections']),'classes':len(lessons),'mappedSourceTopics':len(set(k for l in lessons for k in l['sourceTopics'])),'scoreReferences':sum(len(l['scores']) for l in lessons),'withoutScore':[l['id'] for l in lessons if not l['scores']],'remainingVideoVerification':[l['id'] for l in lessons if not l['status']['videoVerified']]}
(OUT/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v if not isinstance(v,list) else len(v) for k,v in report.items()},indent=2))
