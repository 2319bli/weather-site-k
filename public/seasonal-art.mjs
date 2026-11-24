// Each plate has its own palette (sky, highlight, distance, foreground, ink) and drawing.
const plates = [
  'd7e8eb ffffef 90bdc7 48828c 1e3f52',
  'b9d9d3 fedda1 94b082 477566 1f414b',
  '8ea0b4 feda9b 5f798f 425e7e 203553',
  'd0ddc9 fffce6 9eb679 5d7946 2a4b3b',
  'a7bacd f8ebc0 7395a3 51687f 313d55',
  'e3daab ffc843 adac65 7b8953 485337',
  'bcdaea f2622f 8bb392 628a69 334c54',
  '809fa8 ffe38b a7ae87 4e8077 2c4a4a',
  'f5b67f ffe6a1 c68777 9b6b62 5b475d',
  'e1c4c0 ffe7d9 e28fa1 9c6d69 5c3b51',
  'b0d5d6 ffe089 95bb9c 6c9171 305b52',
  'bbcdd9 a1a0ff 81a19b 4b7b6f 2f4e57',
  '9bd0e5 fff5d7 abc897 709a72 3f6263',
  'a8ccaf fbf1cf 81ae83 51815f 304f3f',
  'ebbe96 ffe4a7 c49287 85758a 4c4a5f',
  'c8ddd7 f5efd4 93bdbc 679fa1 306874',
  'd8dcaf fff5c4 a5ba7d 768c43 425c3e',
  'f3ad60 ffde89 be866b 8c736a 574658',
  'f3cc7e ffedb3 e4ae4b c3892f 795a37',
  '9393ad ffd68b 6f7a89 4f566a 34384e',
  'b2d7ce fdd072 cdb561 b78f4a 73643e',
  '87bdd4 ffe7cd cbb5a6 8a9da4 556781',
  '303b64 ffe197 4d5d82 3d4d6e 212d4d',
  'c5bcd3 f4d0d1 b791b0 8f6992 534b70',
  'ae94aa ffd981 b17d85 895d6f 4d3f60',
  'c9d3b6 fff2c2 a1b18f 728965 3d5c46',
  'a3bdc4 ffd074 a6a581 758477 3d5661',
  'e9bb78 fbcc68 c39357 9a7147 5c4c42',
  'eeb56b fdd17b db7a38 a5593b 603c39',
  '99b1bd f8ddb4 7b959e 536f83 2e4b63',
  'bcc5c6 f8dbae 96aaaa 6f898c 425b66',
  'e4af90 ffd596 b48f8c 877a85 514a5e',
  'aac3c2 e9dcb6 8ba29b 59807e 325054',
  'b5cfd7 f8fae4 97b9c4 6b90a2 3f5b6e',
  '819eb0 ffc966 708998 4d657e 2e3f57',
  '2c3c5b fdd588 55667a 3d5067 1f2e48',
];
// A small spot colour for each plate. Text and long surfaces keep their quieter inks.
const spotColours = [
  '20839a',
  '227f78',
  '4467a0',
  '4a8b64',
  '597f9d',
  'ad8328',
  'b65035',
  '418875',
  'b4674d',
  'bd637c',
  '41887f',
  '7560ad',
  '378ca3',
  '388157',
  'a65a54',
  '438a91',
  '8b8634',
  'b67534',
  'af7c1c',
  '825996',
  'a27227',
  '4086a4',
  '8277b4',
  '995b91',
  'a86643',
  '66823d',
  '3f7b85',
  'a76b31',
  'b56331',
  '3e7888',
  '537b86',
  'aa674f',
  '2b7f7c',
  '417f99',
  '9e7740',
  '566da2',
];
function cardPrint(canvas, metric, i) {
  const c = canvas.getContext('2d');
  canvas.width = 248;
  canvas.height = 156;
  c.scale(2, 2);
  const [, warm, , mid, ink] = plates[i].split(' ').map((s) => '#' + s),
    accent = '#' + spotColours[i];
  c.lineCap = 'round';
  c.lineJoin = 'round';
  function stroke(points, color = ink, width = 1) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }
  function disk(x, y, r, fill) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }
  function ellipse(x, y, a, b, angle, fill) {
    c.beginPath();
    c.ellipse(x, y, a, b, angle, 0, 2 * Math.PI);
    c.fillStyle = fill;
    c.fill();
  }
  function curve(points, col, width = 1) {
    c.beginPath();
    c.moveTo(points[0], points[1]);
    c.bezierCurveTo(...points.slice(2));
    c.strokeStyle = col;
    c.lineWidth = width;
    c.stroke();
  }
  // A seasonal sprig beside each instrument.
  const season = Math.floor(((i + 3) % 36) / 9);
  for (let j = 0; j < 3; j++) {
    const x = 76 + j * 12,
      y = 23 + ((j * 13 + i * 3) % 15);
    curve([x - 7, 76, x - 4, 57, x + 4, 42, x, y], mid, 1.1);
    for (let k = 0; k < 4; k++) {
      const yy = y + 4 + k * 5,
        side = k % 2 ? 1 : -1;
      if (season === 0) {
        stroke(
          [
            [x, yy + 4],
            [x + side * 6, yy],
            [x + side * 8, yy - 4],
          ],
          mid,
        );
        disk(x + side * 8, yy - 4, 1.2, warm);
      } else if (season === 1) {
        ellipse(x + side * 4, yy, 4.5, 2, side * 0.72, mid);
        if (k < 2) disk(x + side * 7, yy - 3, 2.1, warm);
      } else if (season === 2) {
        ellipse(x + side * 2, yy, 4.6, 1.7, side * 1.0, accent);
      } else {
        ellipse(x + side * 3, yy, 4.8, 2.3, side * 0.6, k === 1 ? accent : mid);
      }
    }
  }
  if (metric === 0) {
    // Liquid-in-glass thermometer with a ruled scale
    c.fillStyle = '#fffaf0';
    c.strokeStyle = ink;
    c.lineWidth = 1.6;
    c.beginPath();
    c.roundRect(38, 10, 11, 48, 5);
    c.fill();
    c.stroke();
    disk(43.5, 59, 9, ink);
    disk(43.5, 59, 7, '#fffaf0');
    stroke(
      [
        [43.5, 27],
        [43.5, 58],
      ],
      accent,
      3,
    );
    disk(43.5, 59, 5, accent);
    for (let j = 0; j < 8; j++)
      stroke(
        [
          [52, 16 + j * 5],
          [j % 2 ? 56 : 60, 16 + j * 5],
        ],
        ink,
        0.9,
      );
  } else if (metric === 1) {
    // Graduated rain gauge
    stroke(
      [
        [31, 32],
        [35, 65],
        [56, 65],
        [60, 32],
      ],
      ink,
      1.6,
    );
    stroke(
      [
        [29, 32],
        [61, 32],
      ],
      ink,
      2,
    );
    c.fillStyle = accent;
    c.beginPath();
    c.moveTo(34, 46);
    c.quadraticCurveTo(40, 43, 47, 46);
    c.quadraticCurveTo(52, 48, 57, 44);
    c.lineTo(55, 63);
    c.lineTo(36, 63);
    c.fill();
    for (let j = 0; j < 5; j++)
      stroke(
        [
          [49, 39 + j * 5],
          [55, 39 + j * 5],
        ],
        j < 2 ? ink : '#fffaf0',
        1,
      );
    for (const [x, y] of [
      [34, 20],
      [44, 13],
      [54, 23],
    ]) {
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(x, y - 6);
      c.quadraticCurveTo(x - 6, y + 3, x, y + 3);
      c.quadraticCurveTo(x + 5, y + 3, x, y - 6);
      c.fill();
    }
  } else {
    // Campbell–Stokes sunshine recorder
    const g = c.createRadialGradient(40, 27, 2, 47, 34, 16);
    g.addColorStop(0, '#fffdf2');
    g.addColorStop(0.48, warm);
    g.addColorStop(1, mid);
    disk(46, 34, 15.8, ink);
    disk(46, 34, 14.6, g);
    curve([24, 33, 25, 66, 69, 69, 70, 33], ink, 3);
    curve([28, 36, 30, 57, 62, 61, 67, 37], accent, 3);
    stroke(
      [
        [47, 58],
        [47, 65],
      ],
      ink,
      3,
    );
    stroke(
      [
        [34, 66],
        [59, 66],
      ],
      ink,
      3,
    );
    for (let j = 0; j < 6; j++) {
      let a = Math.PI + (j * Math.PI) / 5;
      stroke(
        [
          [46 + Math.cos(a) * 23, 34 + Math.sin(a) * 23],
          [46 + Math.cos(a) * 27, 34 + Math.sin(a) * 27],
        ],
        mid,
        1,
      );
    }
  }
}

export { plates, spotColours, cardPrint };
