// Monthly pigments for the sky, horizon, fields, foliage and branches.
// Day length, leaf cover and the weather change within each month.
const months = [
  ['#b0cbd8', '#f8eee1', '#a9bdba', '#dce3d6', '#638077', '#584e48', 0],
  ['#bbced4', '#fbebd4', '#92a99b', '#bbbf9a', '#829168', '#594f42', 0.05],
  ['#a5cada', '#faedc8', '#86a78e', '#b1c383', '#82974e', '#595747', 0.2],
  ['#a4d3db', '#fff1ce', '#7eab91', '#b2cb78', '#82a65b', '#514f3e', 0.57],
  ['#93cbdc', '#fff1c9', '#71a398', '#abc96a', '#629354', '#474e38', 0.88],
  ['#97cedc', '#ffeabe', '#78a38a', '#a9c06d', '#5e8751', '#494e3c', 1],
  ['#91c7d9', '#fff0c6', '#84a38e', '#d4ba69', '#6b8b49', '#4d4e37', 1],
  ['#9dbdd3', '#ffe3c7', '#92a698', '#d7b46d', '#899346', '#56513c', 0.92],
  ['#a6bdcb', '#efdab2', '#8c9c83', '#c3a463', '#ad944a', '#64523a', 0.76],
  ['#b3c2be', '#ffe3b9', '#9b9b82', '#bf975b', '#b16b39', '#644831', 0.6],
  ['#aab8bd', '#eedac4', '#879a8f', '#ad9e7a', '#97623c', '#5a4841', 0.23],
  ['#a6becf', '#ede8d9', '#91a8a6', '#d1d8bf', '#566e65', '#504a48', 0],
];
const weather = [
  'frost',
  'thaw',
  'front',
  'snow',
  'sleet',
  'catkins',
  'wind',
  'shower',
  'sunset',
  'blossom',
  'rainbow',
  'bluebells',
  'cumulus',
  'blossom',
  'swifts',
  'mist',
  'flowers',
  'sunset',
  'haze',
  'thunder',
  'harvest',
  'cloudlets',
  'meteors',
  'heather',
  'moon',
  'dew',
  'front',
  'wind',
  'leaves',
  'gale',
  'mist',
  'flock',
  'rain',
  'frost',
  'sleet',
  'stars',
];

export function drawLandscape(canvas, index) {
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(box.width * ratio);
  canvas.height = Math.round(box.height * ratio);
  const ctx = canvas.getContext('2d');
  const h = 640,
    w = Math.max(480, (h * box.width) / box.height);
  ctx.scale(canvas.width / w, canvas.height / h);
  const month = Math.floor(index / 3),
    third = index % 3,
    kind = weather[index];
  const [sky, horizon, hills, field, leaf, bark, cover] = months[month];
  const night = ['meteors', 'stars', 'moon'].includes(kind);
  const wet = ['rain', 'sleet', 'shower', 'front', 'thunder', 'gale'].includes(kind);
  let seed = 92831 + index * 197;
  function rand(low, high) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return low + (seed / 4294967296) * (high - low);
  }
  function oval(x, y, rx, ry, colour, angle = 0) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  function stroke(x, y, xx, yy, colour, width = 1) {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xx, yy);
    ctx.stroke();
  }
  function band(y, amplitude, scale, phase, colour) {
    const points = (x) =>
      y +
      amplitude *
        (0.57 * Math.sin(x / scale + phase) +
          0.28 * Math.sin(x / (scale * 0.42) + phase) +
          0.15 * Math.cos(x / (scale * 1.7) - phase));
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-3, h + 2);
    for (let x = -3; x <= w + 7; x += 5) ctx.lineTo(x, points(x));
    ctx.lineTo(w + 7, h + 2);
    ctx.closePath();
    ctx.fill();
    return points;
  }
  const skyWash = ctx.createLinearGradient(0, 0, 0, 350);
  skyWash.addColorStop(0, night ? '#64758d' : wet ? '#9db4bc' : sky);
  skyWash.addColorStop(1, night ? '#dcc8bf' : horizon);
  ctx.fillStyle = skyWash;
  ctx.fillRect(0, 0, w, h);
  const sunX = w * (0.18 + 0.25 * third),
    sunY = month < 2 || month >= 10 ? 218 : 115 + third * 26;
  if (night) {
    for (let j = 0; j < 74; j++) {
      const s = rand(0.4, 1.45);
      oval(rand(0, w), rand(0, 220), s, s, '#fffae1');
    }
    if (kind === 'meteors')
      for (let k = 0; k < 4; k++) {
        const x = rand(w * 0.25, w * 0.85),
          y = rand(28, 128);
        stroke(x, y, x + rand(17, 46), y - 16, '#f7e5c8', 1.3);
      }
    if (kind !== 'meteors') oval(sunX, sunY - 68, 22, 22, '#fbe6b7');
  } else if (!wet) {
    const halo = ctx.createRadialGradient(sunX, sunY, 9, sunX, sunY, 95);
    halo.addColorStop(0, '#fff8cdcc');
    halo.addColorStop(1, '#fff2bc00');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 96, sunY - 96, 192, 192);
    oval(sunX, sunY, 18, 18, '#fff5cf');
  }
  ctx.globalAlpha = wet ? 0.5 : 0.34;
  const count = kind === 'cloudlets' ? 57 : wet ? 23 : 12;
  for (let j = 0; j < count; j++) {
    const x = rand(-30, w + 30),
      y = rand(35, 223),
      size = kind === 'cloudlets' ? rand(10, 29) : rand(28, 77);
    for (let k = 0; k < 5; k++)
      oval(
        x + size * k * 0.26,
        y + Math.sin(k * 1.15) * size * 0.07,
        size * 0.4,
        size * (kind === 'cumulus' ? 0.22 : 0.105),
        wet ? '#82969d' : '#fff5df',
      );
  }
  ctx.globalAlpha = 1;
  if (kind === 'thunder') {
    ctx.fillStyle = '#747c90';
    ctx.beginPath();
    ctx.moveTo(w * 0.44, 86);
    ctx.bezierCurveTo(w * 0.6, 58, w * 0.7, 80, w * 0.91, 53);
    ctx.bezierCurveTo(w * 0.86, 92, w * 0.75, 99, w * 0.73, 117);
    ctx.bezierCurveTo(w * 0.77, 156, w * 0.51, 164, w * 0.56, 122);
    ctx.closePath();
    ctx.fill();
  }
  if (kind === 'rainbow')
    for (const [j, col] of ['#da8c71', '#e5ba70', '#d9d189', '#92b690', '#8fabc0'].entries()) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w * 0.74, 313, 102 - j * 4, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  ctx.globalAlpha = 1;
  const ridge = 243 + 21 * Math.sin(index * 1.4);
  band(ridge, 43, 142, month * 0.36, hills);
  const snowCover = kind === 'snow' || kind === 'frost';
  const mid = band(ridge + 48, 31, 107, 1.2 + third, snowCover ? '#e1e7e0' : field);
  if (kind === 'harvest') {
    for (let j = 0; j < 9; j++) {
      const x = rand(0, w),
        y = mid(x) + rand(17, 103),
        r = 4 + (y - ridge) / 22;
      oval(x + 2.5, y, r * 1.3, r, '#a88148');
      oval(x, y, r, r, '#e9c987');
      ctx.strokeStyle = '#b29256';
      ctx.lineWidth = 0.8;
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.arc(x, y, (r * k) / 3, 0.14, 6.0);
        ctx.stroke();
      }
    }
  }
  if (kind === 'heather' || kind === 'bluebells' || kind === 'flowers') {
    const colour = { heather: '#ae84a1', bluebells: '#847ba9', flowers: '#ece4ab' }[kind];
    for (let j = 0; j < 350; j++) {
      const x = rand(0, w),
        depth = rand(8, 160);
      oval(x, mid(x) + depth, 1 + depth / 22, 0.7 + depth / 90, colour, -0.15);
    }
  }
  // Hedge banks follow the lay of the fields.
  for (let j = 0; j < 3; j++) {
    ctx.strokeStyle = bark;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = j + 1;
    ctx.beginPath();
    ctx.moveTo(-2, mid(0) + 42 + j * 36);
    ctx.bezierCurveTo(w * 0.28, 291 + j * 31, w * 0.69, 394 + j * 28, w + 4, mid(w) + 32 + j * 53);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let x = -5; x < w + 5; x += rand(6, 15)) {
    const r = rand(2, 5);
    oval(x, mid(x) + 1, r, r * 0.7, hills);
  }
  if (['mist', 'thaw', 'rain', 'dew'].includes(kind)) {
    ctx.globalAlpha = 0.3;
    for (let j = 0; j < 27; j++)
      oval(rand(-40, w + 40), rand(ridge + 5, ridge + 95), rand(26, 108), rand(1, 4), '#f9f5e6');
    ctx.globalAlpha = 1;
  }
  if (kind === 'rain' || kind === 'thaw') {
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.moveTo(w * 0.57, mid(w * 0.57) + 16);
    ctx.bezierCurveTo(w * 0.99, 365, w * 0.2, 420, w * 0.88, h);
    ctx.lineTo(w, h);
    ctx.bezierCurveTo(w * 0.28, 423, w * 0.97, 364, w * 0.57, mid(w * 0.57) + 16);
    ctx.fill();
  }
  if (['flock', 'swifts', 'wind', 'gale'].includes(kind)) {
    const count = kind === 'flock' ? 160 : 11;
    for (let j = 0; j < count; j++) {
      const t = rand(0, 1),
        x = w * (0.46 + t * 0.43),
        y = 161 + Math.sin(t * 6) * 21 + rand(-10, 10),
        s = rand(1, 3.5);
      stroke(x - s, y - 1, x, y + 1, bark, 0.85);
      stroke(x, y + 1, x + s, y - 1.8, bark, 0.85);
    }
  }
  // Changing buds, blossom and leaf fall give the same hedgerow a calendar.
  function branch(x, y, length, angle, depth) {
    const xx = x + length * Math.cos(angle),
      yy = y + length * Math.sin(angle);
    ctx.lineCap = 'round';
    stroke(x, y, xx, yy, bark, Math.max(0.7, depth * depth * 0.43));
    if (depth <= 3) {
      for (let j = 0; j < 9; j++) {
        const t = rand(0.12, 1),
          px = x + (xx - x) * t + rand(-9, 9),
          py = y + (yy - y) * t + rand(-7, 7);
        if (rand(0, 1) < cover) {
          const autumn = month === 9 || month === 10,
            blossom = kind === 'blossom';
          const pigment =
            blossom && j % 3 === 0
              ? '#fff1e1'
              : autumn && j % 3 === 0
                ? '#d59145'
                : j % 4 === 1
                  ? hills
                  : leaf;
          oval(px, py, rand(2.6, 5.8), rand(1.7, 3.6), pigment, angle + rand(-1, 1));
        } else if (kind === 'frost' || kind === 'snow') stroke(px - 2, py, px + 2, py - 2, '#eaf7ef', 1.2);
        else if (kind === 'catkins' && j % 4 === 0) oval(px, py + 3, 1.7, 4.6, '#b89c4e');
      }
    }
    if (depth <= 1) return;
    branch(xx, yy, length * rand(0.66, 0.79), angle - rand(0.2, 0.55), depth - 1);
    branch(xx, yy, length * rand(0.61, 0.75), angle + rand(0.2, 0.58), depth - 1);
  }
  ctx.save();
  ctx.translate(w + 16, 327 + third * 17);
  ctx.scale(-1, 1);
  branch(0, 0, 68 + (month % 3) * 5, -1.1, 7);
  ctx.restore();
  branch(-10, h - 12, 67, -1.22, 6);
  // Seed heads, wet reeds and field flowers rise out of the lower margins.
  for (let j = 0; j < 124; j++) {
    const edge = rand(0, 1),
      x = edge < 0.5 ? rand(-11, w * 0.23) : rand(w * 0.8, w + 12);
    const y = h + rand(0, 17),
      height = rand(17, 85) * (month === 6 || month === 7 ? 1.38 : 1);
    const tip = x + rand(-15, 18) + (kind === 'gale' ? 19 : 0);
    stroke(x, y, tip, y - height, leaf, rand(0.8, 1.7));
    if (month >= 5 && month <= 8) {
      for (let k = 0; k < 5; k++)
        oval(
          tip + ((k % 2) * 2 - 1) * 2,
          y - height + k * 2.8,
          3,
          1.15,
          month === 7 && third === 2 ? '#96739e' : '#c7a35d',
          k % 2 ? 0.65 : -0.65,
        );
    } else if (month >= 2 && month <= 4) {
      const col = kind === 'bluebells' ? '#8576ae' : month === 2 ? '#ebcb65' : '#f6e9d2';
      oval(tip, y - height, 3.2, 2, col, -0.35);
    }
  }
  if (wet || kind === 'snow' || kind === 'frost' || kind === 'leaves') {
    ctx.globalAlpha = 0.53;
    for (let j = 0; j < 116; j++) {
      const x = rand(0, w),
        y = rand(0, h);
      if (kind === 'leaves') oval(x, y, 4, 1.7, leaf, rand(-1, 1));
      else if (wet) stroke(x, y, x - (kind === 'gale' ? 9 : 3), y + rand(5, 11), '#eaf1ed', 0.9);
      else {
        const s = rand(0.7, 2);
        oval(x, y, s, s, '#f9fffc');
      }
    }
    ctx.globalAlpha = 1;
  }
}
