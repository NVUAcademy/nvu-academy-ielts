/* Đổi bản ghi của trình duyệt (webm/mp4) sang WAV 16 kHz mono 16-bit để Azure chấm phát âm được. */
async function blobToWav16k(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const arr = await blob.arrayBuffer();
  const audio = await new Promise((res, rej) => ctx.decodeAudioData(arr, res, rej));
  if (ctx.close) ctx.close();
  const len = Math.max(1, Math.ceil(audio.duration * 16000));
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
  const data = (await off.startRendering()).getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + data.length * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) { const s = Math.max(-1, Math.min(1, data[i])); view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([view], { type: 'audio/wav' });
}
