const {test}=require('node:test'), assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const ID=require('../scripts/record-id.js');
test('uses native UUID when available',()=>{
  assert.equal(ID.create({randomUUID:()=> 'native-id'}),'native-id');
});
test('HTTP-compatible generator produces v4 variant UUIDs with fresh secure random bytes',()=>{
  const api={getRandomValues:array=>webcrypto.getRandomValues(array)};
  const ids=Array.from({length:1000},()=>ID.create(api));
  assert.equal(new Set(ids).size,1000);
  assert.ok(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
});
test('explicit failure without a secure random source',()=>{
  assert.throws(()=>ID.create({}),/기록 ID/);
  assert.throws(()=>ID.create(null),/기록 ID/);
});
