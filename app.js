const fileInput = document.getElementById('fileInput');
const photoList = document.getElementById('photoList');
const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const defaultDurationInput = document.getElementById('defaultDuration');

let photos = []; // { img, duration }

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    photos.push({ img, duration: parseFloat(defaultDurationInput.value) || 3 });
  }
  renderPhotoList();
});

function renderPhotoList() {
  photoList.innerHTML = '';
  photos.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'photo-item';
    div.innerHTML = `
      <img src="${p.img.src}"><br>
      <input type="number" value="${p.duration}" min="0.5" max="30" step="0.5" data-index="${i}">
      <button data-index="${i}" class="remove">✕</button>
    `;
    photoList.appendChild(div);
  });

  photoList.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      photos[e.target.dataset.index].duration = parseFloat(e.target.value);
    });
  });
  photoList.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      photos.splice(e.target.dataset.index, 1);
      renderPhotoList();
    });
  });
}

async function playSequence(record = false) {
  if (photos.length === 0) return alert('Add some photos first');

  const stream = canvas.captureStream(30);
  let recorder;
  let chunks = [];

  if (record) {
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
  }

  for (let i = 0; i < photos.length; i++) {
    const { img, duration } = photos[i];
    const frames = Math.floor(duration * 30);
    for (let f = 0; f < frames; f++) {
      const progress = f / frames;
      drawKenBurns(img, progress);
      await new Promise(r => setTimeout(r, 33));
    }
  }

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

function drawKenBurns(img, progress) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const zoom = 1 + progress * 0.15; // subtle zoom
  const w = canvas.width * zoom;
  const h = canvas.height * zoom;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;

  ctx.drawImage(img, x, y, w, h);
}

previewBtn.addEventListener('click', () => playSequence(false));
exportBtn.addEventListener('click', () => playSequence(true));
