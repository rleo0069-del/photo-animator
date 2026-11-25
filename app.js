const fileInput = document.getElementById('fileInput');
const photoList = document.getElementById('photoList');
const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const defaultDurationInput = document.getElementById('defaultDuration');
const musicInput = document.getElementById('musicInput');
const musicVolume = document.getElementById('musicVolume');
const crossfadeDurationInput = document.getElementById('crossfadeDuration');
const totalDurationEl = document.getElementById('totalDuration');

let photos = [];
let music = null;
let draggedItem = null;

const styles = [
  'kenburns', 'zoom-in', 'zoom-out',
  'pan-left', 'pan-right', 'pan-up', 'pan-down',
  'rotate', 'static'
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

function updateTotalDuration() {
  const total = photos.reduce((sum, p) => sum + p.duration, 0);
  totalDurationEl.textContent = `Total duration: ${total.toFixed(1)}s`;
}

function renderPhotoList() {
  photoList.innerHTML = '';
  photos.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'photo-item';
    div.draggable = true;
    div.dataset.index = i;
    div.innerHTML = `
      <img src="${p.img.src}"><br>
      Duration: <input type="number" value="${p.duration}" min="0.5" max="30" step="0.5" class="duration">
      Style:
      <select class="style">
        ${styles.map(s => `<option value="${s}" ${s === p.style ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      Text:
      <textarea class="text" placeholder="Optional text">${p.text}</textarea>
      <button class="remove">Remove</button>
    `;
    photoList.appendChild(div);

    div.querySelector('.duration').addEventListener('change', e => {
      photos[i].duration = parseFloat(e.target.value);
      updateTotalDuration();
    });
    div.querySelector('.style').addEventListener('change', e => photos[i].style = e.target.value);
    div.querySelector('.text').addEventListener('input', e => photos[i].text = e.target.value);
    div.querySelector('.remove').addEventListener('click', () => {
      photos.splice(i, 1);
      renderPhotoList();
    });

    div.addEventListener('dragstart', () => {
      draggedItem = i;
      div.classList.add('dragging');
    });
    div.addEventListener('dragend', () => div.classList.remove('dragging'));
    div.addEventListener('dragover', e => e.preventDefault());
    div.addEventListener('drop', e => {
      e.preventDefault();
      const targetIndex = parseInt(div.dataset.index);
      if (draggedItem !== null && draggedItem !== targetIndex) {
        const [moved] = photos.splice(draggedItem, 1);
        photos.splice(targetIndex, 0, moved);
        renderPhotoList();
      }
    });
  });
  updateTotalDuration();
}

function drawFrame(img, style, progress, text) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let scale = 1, x = 0, y = 0, rotation = 0;
  const baseW = canvas.width;
  const baseH = canvas.height;

  if (style === 'kenburns' || style === 'zoom-in') scale = 1 + progress * 0.2;
  else if (style === 'zoom-out') scale = 1.2 - progress * 0.2;
  else if (style === 'pan-left') { scale = 1.15; x = -progress * 100; }
  else if (style === 'pan-right') { scale = 1.15; x = (progress - 1) * 100; }
  else if (style === 'pan-up') { scale = 1.15; y = -progress * 80; }
  else if (style === 'pan-down') { scale = 1.15; y = (progress - 1) * 80; }
  else if (style === 'rotate') rotation = progress * 8;

  ctx.save();
  ctx.translate(baseW / 2, baseH / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.translate(-baseW / 2, -baseH / 2);

  const w = baseW * scale;
  const h = baseH * scale;
  const drawX = (baseW - w) / 2 + x;
  const drawY = (baseH - h) / 2 + y;

  ctx.drawImage(img, drawX, drawY, w, h);
  ctx.restore();

  if (text) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, canvas.height - 130, canvas.width, 130);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height - 55);
  }
}

async function playSequence(record = false) {
  if (photos.length === 0) return alert('Add some photos first');

  const canvasStream = canvas.captureStream(30);
  let finalStream = canvasStream;
  let audioEl = null;
  let audioContext = null;

  if (music) {
    audioEl = new Audio(music);
    audioEl.volume = parseFloat(musicVolume.value);
    audioEl.loop = true;

    if (record) {
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audioEl);
      const dest = audioContext.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioContext.destination); // so you can hear it too
      finalStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);
    }
    audioEl.play().catch(() => {});
  }

  let recorder, chunks = [];
  if (record) {
    recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
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
  if (audioContext) audioContext.close();

  if (record) {
    recorder.stop();
    await new Promise(r => recorder.onstop = r);
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photo-animation.webm';
    a.click();
    status.textContent = 'Video exported with music!';
  }
}

previewBtn.addEventListener('click', () => playSequence(false));
exportBtn.addEventListener('click', () => playSequence(true));
