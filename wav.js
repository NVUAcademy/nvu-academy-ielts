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

/* Phát hiện bản ghi im lặng (micro bị chặn, tắt tiếng, ghi nhầm): đo đỉnh và RMS của âm thanh (0..1).
   Im lặng = đỉnh dưới 0,02 (khoảng -34 dBFS): giọng nói thật, kể cả nói nhỏ hoặc xa micro, luôn có đỉnh cao hơn mức này.
   Trả null nếu trình duyệt không giải mã được (khi đó không chặn gì). */
const SILENT_PEAK = 0.02;
async function blobLevel(blob) {
  try {
    const arr = await blob.arrayBuffer();
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let audio;
    if (OAC) {
      const off = new OAC(1, 16000, 16000);
      audio = await new Promise((res, rej) => { const p = off.decodeAudioData(arr, res, rej); if (p && p.then) p.then(res, rej); });
    } else {
      const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      audio = await new Promise((res, rej) => ctx.decodeAudioData(arr, res, rej));
      if (ctx.close) ctx.close();
    }
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
      n += d.length;
    }
    return n ? { peak, rms: Math.sqrt(sum / n) } : null;
  } catch (e) { return null; }
}
const isSilentLevel = lv => !!lv && lv.peak < SILENT_PEAK;
