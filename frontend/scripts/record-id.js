(function(root, factory) {
  const api=factory();
  if(typeof module==='object') module.exports=api;
  else root.MomentRecordId=api;
})(globalThis, function() {
  'use strict';
  function create(cryptoAPI=globalThis.crypto) {
    if(typeof cryptoAPI?.randomUUID==='function') return cryptoAPI.randomUUID();
    if(typeof cryptoAPI?.getRandomValues!=='function') throw Error('이 브라우저에서는 기록 ID를 만들 수 없어요. 최신 브라우저로 열어 주세요.');
    const bytes=cryptoAPI.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;
    bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  return {create};
});
