const {test}=require('node:test'),assert=require('node:assert/strict'),{traverse}=require('./repertoire-traversal.cjs');
const row=(nav=[],other={})=>({bars:Array.from({length:6},()=>[]),nav,...other});
test('DC al Fine plays beginning twice and stops at Fine on return',()=>{const r=traverse([row([{bar:2,text:'Fine'},{bar:5,text:'D.C. al Fine'}])]);assert.deepEqual(r.map(x=>x.index),[0,1,2,3,4,5,0,1,2])});
test('DS al Coda jumps only after returning to Segno',()=>{const r=traverse([row([{bar:1,symbol:'segno'},{bar:2,text:'A Coda'},{bar:3,text:'D.S. al Coda'},{bar:4,symbol:'coda'}])]);assert.deepEqual(r.map(x=>x.index),[0,1,2,3,1,2,4,5])});
test('first and second ending do not both play on second pass',()=>{const r=traverse([row([],{barStyles:{2:'repeat'},endings:[{from:2,to:2,number:'1'},{from:3,to:3,number:'2'}]})]);assert.deepEqual(r.map(x=>x.index),[0,1,2,0,1,3,4,5])});
test('first and second passes repeat before taking the third ending',()=>{const r=traverse([{bars:[[],[],[],[]],barStyles:{2:'repeat'},endings:[{from:2,to:2,number:'1,2'},{from:3,to:3,number:'3'}]}]);assert.deepEqual(r.map(x=>x.index),[0,1,2,0,1,2,0,1,3])});
