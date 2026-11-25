
const fileInput = document.getElementById('fileInput');
const photoList = document.getElementById('photoList');
const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const defaultDurationInput = document.getElementById('defaultDuration');
const musicInput = document.getElementById('musicInput');
const crossfadeDurationInput = document.getElementById('crossfadeDuration');

let photos = []; // { img, duration, text, style }
let music = null;

const styles = [
  'kenburns',
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
  'static'
];

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    photos.push({
      img,
      duration: parseFloat(defaultDurationInput.value) || 3,
      text: '',
      style: 'kenburns'
    });
  }
  renderPhotoList();
});

musicInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) music = URL.createObjectURL(file);
});

function renderPhotoList() {
  photoList.innerHTML = '';
  photos.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'photo-item';
    div.innerHTML = `
      <img src="${p.img.src}"><br>
      Duration: <input type="number" value="${p.duration}" min="0.5" max="30" step="0.5" data-index="${i}" class="duration">
      Style:
      <select data-index="${i}" class="style">
        ${styles.map(s => `<option value="${s}" ${s === p.style ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      Text overlay:
      <textarea data-index="${i}" class="text" placeholder="Optional text">${p.text}</textarea>
      <button data-index="${i}" class="remove">Remove</button>
    `;
    photoList.appendChild(div);
  });

  photoList.querySelectorAll('.duration').forEach(el => {
    el.addEventListener('change', e => photos[e.target.dataset.index].duration = parseFloat(e.target.value));
  });
  photoList.querySelectorAll('.style').forEach(el => {
    el.addEventListener('change', e => photos[e.target.dataset.index].style = e.target.value);
  });
  photoList.querySelectorAll('.text').forEach(el => {
    el.addEventListener('input', e => photos[e.target.dataset.index].text = e.target.value);
  });
  photoList.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      photos.splice(e.target.dataset.index, 1);
      renderPhotoList();
    });
  });
}

function drawFrame(img, style, progress, text) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let scale = 1, x = 0, y = 0;
  const baseW = canvas.width;
  const baseH = canvas.height;

  if (style === 'kenburns' || style === 'zoom-in') {
    scale = 1 + progress * 0.18;
  } else if (style === 'zoom-out') {
    scale = 1.18 - progress * 0.18;
  } else if (style === 'pan-left') {
    scale = 1.1;
    x = -progress * 80;
  } else if (style === 'pan-right') {
    scale = 1.1;
    x = (progress - 1) * 80;
  }

  const w = baseW * scale;
  const h = baseH * scale;
  const drawX = (baseW - w) / 2 + x;
  const drawY = (baseH - h) / 2 + y;

  ctx.drawImage(img, drawX, drawY, w, h);

  // Text overlay
  if (text) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height - 50);
  }
}

async function playSequence(record = false) {
  if (photos.length === 0) return alert('Add some photos first');

  const stream = canvas.captureStream(30);
  let recorder, chunks = [];
  let audioEl = null;

  if (music && record) {
    audioEl = new Audio(music);
    audioEl.loop = true;
    audioEl.play().catch(() => {});
  }

  if (record) {
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
  }

  const crossfade = parseFloat(crossfadeDurationInput.value) || 0;

  for (let i = 0; i < photos.length; i++) {
    const current = photos[i];
    const next = photos[i + 1];
    const frames = Math.floor(current.duration * 30);
    const fadeFrames = Math.floor(crossfade * 30);

    for (let f = 0; f < frames; f++) {
      const progress = f / frames;
      drawFrame(current.img, current.style, progress, current.text);

      // Crossfade into next photo near the end
      if (next && f > frames - fadeFrames) {
        const fadeProgress = (f - (frames - fadeFrames)) / fadeFrames;
        ctx.globalAlpha = fadeProgress;
        drawFrame(next.img, next.style, 0, next.text);
        ctx.globalAlpha = 1;
      }

      await new Promise(r => setTimeout(r, 33));
    }
  }

  if (audioEl) audioEl.pause();

  if (record) {
    recorder.stop();
    await new Promise(r => recorder.onstop = r);
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photo-animation.webm';
    a.click();
    status.textContent = 'Video exported!';
  }
}

previewBtn.addEventListener('click', () => playSequence(false));
exportBtn.addEventListener('click', () => playSequence(true));
