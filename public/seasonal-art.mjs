// Each plate has its own palette (sky, highlight, distance, foreground, ink) and drawing.
const plates = [
  ['Ice ferns', 'd7e8eb ffffef 90bdc7 48828c 1e3f52'],
  ['Thaw water', 'b9d9d3 fedda1 94b082 477566 1f414b'],
  ['Atlantic low', '8ea0b4 feda9b 5f798f 425e7e 203553'],
  ['Snowdrop bank', 'd0ddc9 fffce6 9eb679 5d7946 2a4b3b'],
  ['Sleet on slate', 'a7bacd f8ebc0 7395a3 51687f 313d55'],
  ['Catkin breeze', 'e3daab ffc843 adac65 7b8953 485337'],
  ['Kite weather', 'bcdaea f2622f 8bb392 628a69 334c54'],
  ['Passing squall', '809fa8 ffe38b a7ae87 4e8077 2c4a4a'],
  ['Equinox', 'f5b67f ffe6a1 c68777 9b6b62 5b475d'],
  ['Orchard rain', 'e1c4c0 ffe7d9 e28fa1 9c6d69 5c3b51'],
  ['Sunshower', 'b0d5d6 ffe089 95bb9c 6c9171 305b52'],
  ['Bluebell shade', 'bbcdd9 a1a0ff 81a19b 4b7b6f 2f4e57'],
  ['Chalk and cumulus', '9bd0e5 fff5d7 abc897 709a72 3f6263'],
  ['Hawthorn lace', 'a8ccaf fbf1cf 81ae83 51815f 304f3f'],
  ['Swifts on the wing', 'ebbe96 ffe4a7 c49287 85758a 4c4a5f'],
  ['Sea fret', 'c8ddd7 f5efd4 93bdbc 679fa1 306874'],
  ['Elderflower', 'd8dcaf fff5c4 a5ba7d 768c43 425c3e'],
  ['Solstice stones', 'f3ad60 ffde89 be866b 8c736a 574658'],
  ['Wheat haze', 'f3cc7e ffedb3 e4ae4b c3892f 795a37'],
  ['Anvil storm', '9393ad ffd68b 6f7a89 4f566a 34384e'],
  ['Haymaking', 'b2d7ce fdd072 cdb561 b78f4a 73643e'],
  ['Mackerel sky', '87bdd4 ffe7cd cbb5a6 8a9da4 556781'],
  ['Perseid night', '303b64 ffe197 4d5d82 3d4d6e 212d4d'],
  ['Heather mist', 'c5bcd3 f4d0d1 b791b0 8f6992 534b70'],
  ['Harvest moon', 'ae94aa ffd981 b17d85 895d6f 4d3f60'],
  ['Dew on silk', 'c9d3b6 fff2c2 a1b18f 728965 3d5c46'],
  ['First front', 'a3bdc4 ffd074 a6a581 758477 3d5661'],
  ['Sycamore keys', 'e9bb78 fbcc68 c39357 9a7147 5c4c42'],
  ['Beech canopy', 'eeb56b fdd17b db7a38 a5593b 603c39'],
  ['Gale at the harbour', '99b1bd f8ddb4 7b959e 536f83 2e4b63'],
  ['Valley inversion', 'bcc5c6 f8dbae 96aaaa 6f898c 425b66'],
  ['Murmuration', 'e4af90 ffd596 b48f8c 877a85 514a5e'],
  ['River in spate', 'aac3c2 e9dcb6 8ba29b 59807e 325054'],
  ['Hoarfrost', 'b5cfd7 f8fae4 97b9c4 6b90a2 3f5b6e'],
  ['Beacon in sleet', '819eb0 ffc966 708998 4d657e 2e3f57'],
  ['Long night', '2c3c5b fdd588 55667a 3d5067 1f2e48'],
];
function drawPlate(canvas, index) {
  const W = 600,
    H = 248,
    ctx = canvas.getContext('2d');
  const width = Math.min(
    1600,
    Math.max(480, Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1))),
  );
  canvas.width = width;
  canvas.height = Math.round((width * H) / W);
  ctx.scale(canvas.width / W, canvas.height / H);
  const accent = '#' + spotColours[index];
  const [sky, light, far, mid, ink] = plates[index][1].split(' ').map((x) => '#' + x);
  let seed = 1729 + index * 171;
  const r = (a = 0, b = 1) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return a + ((b - a) * seed) / 4294967296;
  };
  const repeat = (n, fn) => {
    for (let i = 0; i < n; i++) fn(i);
  };
  function shape(pts, fill, stroke = null, lw = 1, close = true) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (close) ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  const line = (pts, col, w = 1) => shape(pts, null, col, w, false);
  function oval(x, y, rx, ry, col, tilt = 0) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
    ctx.fill();
  }
  function arc(x, y, rad, a, b, col, w) {
    ctx.beginPath();
    ctx.arc(x, y, rad, a, b);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  function hill(y, amp, col, phase = 0, freq = 1) {
    let pts = [[-5, 260]];
    for (let x = -5; x <= 605; x += 5)
      pts.push([
        x,
        y +
          amp *
            (Math.sin((x / 84) * freq + phase) * 0.57 +
              Math.cos((x / 152) * freq + phase + 1) * 0.46 +
              Math.sin((x / 36) * freq + phase) * 0.09),
      ]);
    shape([...pts, [605, 260]], col);
  }
  const hills = (y = 174) => {
    hill(y, 24, far, 2);
    hill(y + 22, 27, mid, 0.5);
    hill(y + 52, 18, ink, 3);
  };
  function mist(n = 15, y = 130) {
    ctx.globalAlpha = 0.38;
    repeat(n, () => {
      let x = r(-100, 590);
      oval(x, r(y, y + 55), r(18, 118), r(0.7, 2.2), light);
    });
    ctx.globalAlpha = 1;
  }
  function sun(x = 440, y = 64, s = 34) {
    oval(x, y, s, s, light);
  }
  function rain(n = 70, slant = 5) {
    ctx.globalAlpha = 0.65;
    repeat(n, () => {
      let x = r(-20, 620),
        y = r(-12, 260),
        l = r(4, 15);
      line(
        [
          [x, y],
          [x - slant, y + l],
        ],
        light,
        0.9,
      );
    });
    ctx.globalAlpha = 1;
  }
  function cloud(x, y, s) {
    [
      [-34, 2, 24, 10],
      [-16, -6, 22, 18],
      [4, -14, 24, 22],
      [25, -4, 21, 16],
      [42, 3, 20, 10],
      [0, 6, 48, 10],
    ].forEach(([a, b, c, d]) => oval(x + a * s, y + b * s, c * s, d * s, light));
  }
  function stars(n) {
    repeat(n, () => {
      let d = r(0.4, 1.8);
      oval(r(0, 600), r(0, 165), d, d, light);
    });
  }
  function bird(x, y, s, col = ink) {
    shape(
      [
        [x - s, y - (3 * s) / 7],
        [x - 0.3 * s, y - 0.19 * s],
        [x, y + 0.23 * s],
        [x + 0.42 * s, y - 0.12 * s],
        [x + s, y - 0.24 * s],
        [x + 0.32 * s, y + 0.12 * s],
        [x, y + 0.43 * s],
        [x - 0.35 * s, y + 0.05 * s],
      ],
      col,
    );
  }
  function flower(x, y, s, col, count = 5) {
    repeat(count, (i) => {
      let a = (i * 6.283) / count;
      oval(x + s * 0.65 * Math.cos(a), y + s * 0.65 * Math.sin(a), s * 0.62, s * 0.4, col, a);
    });
    oval(x, y, s * 0.22, s * 0.22, mid);
  }
  function twig(x, y, x2, y2, c, w) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([x + (x2 - x) * t, y + (y2 - y) * t + Math.sin(t * Math.PI) * 8]);
    }
    line(pts, c, w);
  }
  function crystal(x, y, s) {
    repeat(6, (i) => {
      const a = (i * Math.PI) / 3 - 0.2,
        pt = (d, b = 0) => [x + d * Math.cos(a) - b * Math.sin(a), y + d * Math.sin(a) + b * Math.cos(a)];
      line([pt(0), pt(s)], light, 2);
      [0.32, 0.53, 0.74].forEach((t) => {
        line([pt(s * t + s * 0.13, -s * 0.14), pt(s * t), pt(s * t + s * 0.13, s * 0.14)], light, 1.65);
      });
    });
  }
  function field(y = 180) {
    hill(y, 12, far, 0.3);
    hill(y + 17, 9, mid, 2);
    for (let i = -5; i < 13; i++) {
      line(
        [
          [320 + (i - 4) * 9, y + 29],
          [i * 84, 250],
        ],
        far,
        1.4,
      );
    }
  }
  function tree(x, y, h, c) {
    line(
      [
        [x, y],
        [x + 1, y - h * 0.58],
      ],
      c,
      h * 0.05,
    );
    for (let i = 0; i < 4; i++) {
      const a = h * (0.18 + i * 0.14);
      shape(
        [
          [x - a * 0.44, y - i * h * 0.13],
          [x, y - h * 0.44 - i * h * 0.18],
          [x + a * 0.44, y - i * h * 0.13],
        ],
        c,
      );
    }
  }
  function ear(x, y, s, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    line(
      [
        [0, 0],
        [-2, -s],
      ],
      ink,
      1,
    );
    for (let i = 0; i < 8; i++) {
      const h = -s * (0.57 + i * 0.049);
      oval(-4, h, 5.3, 1.8, mid, 0.65);
      oval(2, h - 1, 4.8, 1.8, light, -0.83);
    }
    ctx.restore();
  }
  function sea(y) {
    hill(y, 3, far, 0);
    repeat(65, () => {
      const x = r(0, 595),
        v = r(y + 8, 248);
      line(
        [
          [x, v],
          [x + r(4, 44), v - 1],
        ],
        r() > 0.4 ? mid : light,
        r(0.5, 1.4),
      );
    });
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, sky);
  gradient.addColorStop(1, far);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  switch (index) {
    case 0: // Ice spreading from both edges of a window
      hills(202);
      [
        [46, 62, 54],
        [164, 178, 78],
        [332, 48, 26],
        [436, 126, 83],
        [585, 42, 54],
        [29, 217, 46],
      ].forEach((p) => crystal(...p));
      break;
    case 1: // Meltwater meanders between patches of snow
      sun(458, 68, 26);
      hills(129);
      shape(
        [
          [310, 144],
          [343, 144],
          [307, 161],
          [374, 173],
          [343, 190],
          [450, 211],
          [424, 250],
          [230, 250],
          [373, 215],
          [267, 193],
          [322, 174],
          [273, 164],
        ],
        sky,
      );
      repeat(31, () => {
        const y = r(159, 248);
        oval(r(0, 600), y, r(6, 29), r(0.8, 2.4), light);
      });
      break;
    case 2: // Synoptic low with hand-drawn closed isobars
      for (let k = 0; k < 10; k++) {
        const pts = [];
        for (let t = 0; t <= 160; t++) {
          const a = (t * Math.PI) / 80,
            rad = 14 + k * 18 + Math.sin(a * 3 + k * 0.13) * k * 1.6;
          pts.push([
            326 + rad * Math.cos(a) * 1.66,
            105 + rad * Math.sin(a) * 0.79 + rad * Math.cos(a) * 0.15,
          ]);
        }
        line(pts, k % 3 === 0 ? light : ink, k % 3 === 0 ? 1.7 : 0.85);
      }
      ctx.fillStyle = ink;
      ctx.font = 'italic 32px Georgia';
      ctx.fillText('L', 316, 116);
      break;
    case 3:
      hills(178);
      repeat(27, () => {
        let x = r(-5, 610),
          y = r(105, 204),
          s = r(0.65, 1.3);
        twig(x - 14, 251, x + 3, y, ink, 1.8);
        twig(x + 3, y, x + 14, y + 6, ink, 1.2);
        for (let j = 0; j < 3; j++) oval(x + 12 + j * 2.3, y + 12, 3 * s, 7 * s, light, (j - 1) * 0.22);
        shape(
          [
            [x - 12, 250],
            [x - 19, y + 29],
            [x - 6, 250],
          ],
          mid,
        );
      });
      break;
    case 4:
      for (let i = -1; i < 10; i++) {
        let x = i * 77,
          y = 147 + r(-24, 24);
        shape(
          [
            [x, y + 36],
            [x + 38, y],
            [x + 90, y + 40],
            [x + 87, 253],
            [x, 253],
          ],
          i % 2 ? mid : ink,
        );
        shape(
          [
            [x - 6, y + 37],
            [x + 37, y - 4],
            [x + 89, y + 35],
            [x + 86, y + 39],
            [x + 37, y + 2],
          ],
          far,
        );
        ctx.fillStyle = ink;
        ctx.fillRect(x + 55, y - 7, 8, 27);
        ctx.fillStyle = light;
        ctx.fillRect(x + 33, y + 57, 8, 13);
      }
      rain(130, 6);
      break;
    case 5:
      mist(20, 135);
      for (let k = 0; k < 4; k++) {
        let x = k * 153 - 40;
        twig(x, 249, x + 165, 14, ink, 3);
        repeat(12, (i) => {
          let a = x + i * 12.8,
            b = 245 - i * 18.2;
          let side = i % 2 ? 1 : -1;
          twig(a, b, a + side * 16, b - 20, ink, 1.3);
          oval(a + side * 17, b - 11, 4.8, 15, light, 0.16);
          repeat(5, (j) =>
            line(
              [
                [a + side * 17 - 2, b - 21 + j * 4],
                [a + side * 17 + 3, b - 20 + j * 4],
              ],
              mid,
              0.7,
            ),
          );
        });
      }
      break;
    case 6:
      cloud(120, 65, 0.56);
      hills(185);
      line(
        [
          [152, 244],
          [240, 188],
          [315, 121],
          [394, 62],
        ],
        ink,
        1,
      );
      shape(
        [
          [397, 28],
          [430, 56],
          [394, 106],
          [373, 57],
        ],
        light,
      );
      shape(
        [
          [397, 28],
          [394, 106],
          [373, 57],
        ],
        ink,
      );
      line(
        [
          [394, 106],
          [400, 126],
          [389, 140],
          [398, 154],
        ],
        ink,
        1.2,
      );
      [121, 137, 151].forEach((y, i) =>
        shape(
          [
            [391 + (i % 2) * 4, y - 3],
            [402 + (i % 2) * 4, y + 4],
            [401 + (i % 2) * 4, y - 4],
            [391 + (i % 2) * 4, y + 4],
          ],
          light,
        ),
      );
      break;
    case 7:
      sun(470, 70, 36);
      shape(
        [
          [0, 0],
          [420, 0],
          [330, 42],
          [213, 63],
          [155, 88],
          [0, 114],
        ],
        mid,
      );
      for (let i = 0; i < 85; i++) {
        let x = r(0, 300),
          y = r(28, 177);
        line(
          [
            [x, y],
            [x - 17, y + 29],
          ],
          far,
          1.2,
        );
      }
      hills(170);
      break;
    case 8:
      sun(302, 134, 62);
      hill(141, 7, mid);
      for (let i = 0; i < 16; i++) {
        const y = 146 + i * 5;
        const length = (1 - i / 17) * 66;
        line(
          [
            [299 - length, y],
            [299 + length, y],
          ],
          light,
          2.1,
        );
      }
      hill(219, 19, ink, 1.5);
      break;
    case 9:
      rain(33, 1);
      for (let k = 0; k < 4; k++) {
        let x = k * 157 - 60;
        twig(x, 250, x + 137, 28, ink, 4);
        repeat(9, (i) => {
          let t = i / 10,
            a = x + 135 * t,
            b = 249 - 213 * t,
            side = i % 2 ? 1 : -1;
          twig(a, b, a + side * 31, b - 27, ink, 1.6);
          flower(a + side * 31, b - 27, r(5, 9), light);
          flower(a + side * 20, b - 20, r(3, 6), far);
        });
      }
      break;
    case 10:
      for (const [i, c] of ['#ba7f74', '#e1b283', '#eed799', '#98b198', '#91abb6'].entries())
        arc(365, 216, 163 - i * 5, Math.PI, 2 * Math.PI, c, 5.5);
      cloud(124, 98, 0.7);
      hills(174);
      rain(20, 1);
      break;
    case 11:
      for (let i = 0; i < 18; i++) {
        let x = r(0, 600);
        line(
          [
            [x, 0],
            [x - 19, 200],
          ],
          far,
          r(3, 11),
        );
      }
      hill(150, 23, mid, 1);
      repeat(53, () => {
        const x = r(-9, 600),
          y = r(148, 244),
          h = r(10, 33);
        twig(x, y, x + 5, y - h, ink, 1);
        for (let i = 0; i < 3; i++) {
          const a = x + 4 + i * 2,
            b = y - h + i * 5;
          shape(
            [
              [a, b],
              [a + 3, b - 2],
              [a + 7, b + 5],
              [a + 2, b + 6],
            ],
            light,
          );
        }
      });
      break;
    case 12:
      cloud(117, 72, 0.74);
      cloud(416, 59, 1.12);
      hill(169, 18, mid, 2);
      shape(
        [
          [0, 180],
          [112, 157],
          [224, 166],
          [323, 134],
          [427, 159],
          [491, 146],
          [603, 169],
          [603, 211],
          [474, 175],
          [416, 184],
          [315, 161],
          [222, 191],
          [106, 184],
          [0, 212],
        ],
        light,
      );
      hill(226, 14, ink, 1);
      break;
    case 13:
      hill(189, 14, mid);
      repeat(7, (i) => {
        const x = i * 94 - 20;
        twig(x, 249, x + 34, 104, ink, 3);
        repeat(17, () => {
          const a = x + r(-30, 67),
            b = r(79, 160);
          twig(x + 27, 140, a, b, mid, 1.6);
          oval(a - 4, b + 3, 8, 3, mid, -0.6);
          flower(a, b, r(4, 7), light);
        });
      });
      break;
    case 14:
      sun(105, 87, 44);
      hills(199);
      [
        [168, 66, 27],
        [285, 115, 45],
        [420, 46, 24],
        [493, 89, 55],
        [344, 57, 16],
        [208, 142, 17],
      ].forEach((p) => bird(...p));
      break;
    case 15:
      sea(134);
      shape(
        [
          [0, 174],
          [101, 127],
          [164, 138],
          [229, 148],
          [249, 161],
          [415, 172],
          [0, 193],
        ],
        mid,
      );
      mist(32, 125);
      line(
        [
          [418, 145],
          [418, 91],
        ],
        ink,
        1.4,
      );
      shape(
        [
          [415, 94],
          [392, 137],
          [415, 137],
        ],
        light,
      );
      shape(
        [
          [421, 110],
          [435, 136],
          [421, 136],
        ],
        mid,
      );
      shape(
        [
          [389, 141],
          [440, 141],
          [432, 147],
          [397, 147],
        ],
        ink,
      );
      break;
    case 16:
      for (let k = 0; k < 6; k++) {
        const x = k * 113 - 12,
          y = r(56, 137);
        twig(x - 49, 251, x, y + 42, ink, 2.5);
        for (let j = 0; j < 14; j++) {
          let a = Math.PI + (j * Math.PI) / 13,
            xx = x + Math.cos(a) * r(27, 47),
            yy = y + 20 + Math.sin(a) * 28;
          line(
            [
              [x, y + 42],
              [xx, yy],
            ],
            mid,
            1,
          );
          repeat(9, () => {
            const rad = r(1.1, 2.3);
            oval(xx + r(-6, 6), yy + r(-4, 4), rad, rad, light);
          });
        }
      }
      break;
    case 17:
      sun(335, 100, 49);
      hill(170, 10, far, 1);
      hill(192, 14, mid);
      for (const [x, y, w, h] of [
        [115, 211, 13, 40],
        [185, 201, 24, 69],
        [228, 197, 20, 62],
        [338, 187, 11, 34],
        [395, 201, 23, 64],
        [436, 201, 14, 53],
      ])
        shape(
          [
            [x, y],
            [x + 3, y - h],
            [x + w - 3, y - h - 3],
            [x + w, y],
          ],
          ink,
        );
      shape(
        [
          [181, 136],
          [193, 128],
          [254, 128],
          [252, 140],
          [185, 143],
        ],
        ink,
      );
      hill(230, 11, ink, 3);
      break;
    case 18:
      sun(443, 69, 40);
      hill(172, 7, far);
      repeat(100, () => {
        const x = r(-20, 615),
          y = r(215, 281);
        ear(x, y, r(39, 129), r(-0.36, 0.07));
      });
      break;
    case 19:
      shape(
        [
          [57, 48],
          [132, 54],
          [199, 40],
          [284, 42],
          [359, 24],
          [532, 30],
          [497, 55],
          [385, 69],
          [370, 108],
          [401, 126],
          [205, 140],
          [158, 122],
          [178, 96],
          [136, 76],
        ],
        ink,
      );
      shape(
        [
          [334, 109],
          [315, 149],
          [334, 144],
          [303, 195],
          [351, 133],
          [333, 138],
          [354, 106],
        ],
        light,
      );
      hills(196);
      break;
    case 20:
      cloud(446, 62, 0.74);
      field(150);
      for (const [x, y, z] of [
        [112, 183, 0.55],
        [335, 185, 0.66],
        [457, 221, 1.15],
        [190, 229, 1.02],
      ]) {
        const s = z * 18;
        oval(x + 6, y, s * 1.3, s, mid);
        oval(x, y, s, s, light);
        for (let j = 1; j < 4; j++) arc(x, y, (s * j) / 4, 0.1, 5.95, mid, 0.9);
      }
      break;
    case 21:
      for (let row = 0; row < 9; row++) {
        for (let j = -1; j < 18; j++) {
          const x = j * 43 + (row % 2) * 17,
            y = 5 + row * 15 + 15 * Math.sin(x / 131 + row * 0.3);
          oval(x, y, r(12, 26), r(2.6, 6), light, -0.2);
        }
      }
      sea(181);
      break;
    case 22:
      stars(113);
      for (const [x, y, l] of [
        [150, 80, 49],
        [344, 44, 73],
        [462, 90, 98],
      ]) {
        line(
          [
            [x + l, y - l * 0.42],
            [x, y],
          ],
          far,
          1.1,
        );
        line(
          [
            [x + 13, y - 5],
            [x, y],
          ],
          light,
          1.7,
        );
        oval(x, y, 1.6, 1.6, light);
      }
      hill(164, 28, mid, 1);
      hill(204, 20, ink, 4);
      break;
    case 23:
      hill(126, 38, far, 1);
      mist(18, 122);
      hill(168, 25, mid, 4);
      hill(207, 27, ink, 1);
      repeat(190, () => {
        let x = r(0, 600),
          y = r(207, 256);
        twig(x, y, x + 3, y - 7, mid, 1);
        oval(x + 3, y - 6, r(1.3, 2.4), 2, far);
      });
      break;
    case 24:
      sun(385, 90, 61);
      mist(9, 98);
      hill(170, 7, mid);
      repeat(40, () => {
        let x = r(-10, 610);
        ear(x, 259, r(35, 80), r(-0.22, 0.15));
      });
      break;
    case 25:
      mist(22, 108);
      const cx = 338,
        cy = 105;
      for (let spoke = 0; spoke < 15; spoke++) {
        let a = (spoke * 6.283) / 15;
        line(
          [
            [cx, cy],
            [cx + Math.cos(a) * 380, cy + Math.sin(a) * 240],
          ],
          light,
          1,
        );
      }
      for (let ring = 1; ring <= 10; ring++) {
        const pts = [];
        for (let k = 0; k <= 15; k++) {
          let a = (k * 6.283) / 15;
          pts.push([cx + Math.cos(a) * ring * 22, cy + Math.sin(a) * ring * 13]);
          if (k % 2 === 0 && ring % 2 === 0) oval(...pts.at(-1), 2.1, 2.7, light);
        }
        line(pts, light, 0.95);
      }
      break;
    case 26:
      for (let i = -2; i < 13; i++) {
        const pts = [];
        for (let x = 0; x <= 600; x += 6) pts.push([x, i * 23 + Math.sin(x / 139) * 38 + x * 0.12]);
        line(pts, far, 1.1);
      }
      const fr = (x) => 122 + Math.sin(x / 124) * 42 - x * 0.04;
      line(
        Array.from({ length: 101 }, (_, i) => [i * 6, fr(i * 6)]),
        ink,
        2.4,
      );
      for (let x = 16; x < 600; x += 65)
        shape(
          [
            [x, fr(x)],
            [x + 14, fr(x + 14)],
            [x + 8, fr(x + 8) - 13],
          ],
          ink,
        );
      break;
    case 27:
      repeat(24, () => {
        const x = r(-20, 600),
          y = r(0, 248);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(r(-2, 2));
        oval(-12, -9, 18, 5.5, light, 0.58);
        oval(11, -11, 18, 5.3, mid, -0.74);
        line(
          [
            [-27, -18],
            [0, 1],
            [25, -24],
          ],
          ink,
          0.8,
        );
        oval(0, 1, 3.1, 3.8, ink);
        ctx.restore();
      });
      break;
    case 28:
      for (let t = 0; t < 15; t++) {
        const x = r(-40, 640),
          w = r(3, 12);
        line(
          [
            [x, 250],
            [x - 8, 118],
            [x + 14, -10],
          ],
          ink,
          w,
        );
        line(
          [
            [x - 8, 118],
            [x + 50, 60],
            [x + 84, 24],
          ],
          ink,
          w * 0.38,
        );
      }
      repeat(270, () => {
        let x = r(-6, 605),
          y = r(-4, 135);
        oval(x, y, r(4, 11), r(2, 5), r() > 0.62 ? light : r() > 0.45 ? mid : far, r(-1, 1));
      });
      hill(239, 12, mid);
      break;
    case 29:
      sea(150);
      for (let i = 0; i < 5; i++) {
        const pts = [];
        for (let x = -2; x <= 602; x += 3) {
          let y = 148 + i * 16;
          let u = x / 24 + i * 0.9;
          pts.push([x, y + Math.sin(u) * 8 + Math.sin(2 * u) * 3]);
        }
        line(pts, i % 2 ? ink : light, 2);
      }
      shape(
        [
          [0, 171],
          [172, 151],
          [185, 156],
          [172, 166],
          [0, 200],
        ],
        ink,
      );
      repeat(28, () => {
        const x = r(50, 590),
          y = r(36, 156);
        line(
          [
            [x, y],
            [x + 24, y - 6],
          ],
          light,
          0.9,
        );
      });
      break;
    case 30:
      hill(101, 40, far, 1.1);
      hill(134, 42, mid, 3);
      for (let k = 0; k < 5; k++) {
        hill(144 + k * 8, 14, k % 2 ? far : light, k * 0.73, 0.8);
      }
      hill(199, 38, ink, 2, 1.4);
      break;
    case 31:
      sun(107, 101, 35);
      hills(200);
      repeat(530, () => {
        const t = r(0, 1),
          x = 72 + 450 * t;
        const y =
          100 +
          37 * Math.sin(t * 6.4) -
          16 * Math.sin(t * 11) +
          (r() + r() + r() - 1.5) * (12 + 46 * Math.sin(t * Math.PI));
        bird(x, y, r(0.9, 3));
      });
      break;
    case 32:
      hills(171);
      shape(
        [
          [0, 246],
          [0, 213],
          [172, 184],
          [327, 165],
          [383, 169],
          [249, 192],
          [346, 206],
          [601, 202],
          [601, 251],
        ],
        far,
      );
      for (let k = 0; k < 4; k++) {
        const x = k * 133 - 15;
        ctx.fillStyle = ink;
        ctx.fillRect(x, 130, 11, 71 - k * 4);
        arc(x + 72, 178, 65, Math.PI, 2 * Math.PI, ink, 8);
      }
      line(
        [
          [0, 127],
          [600, 127],
        ],
        ink,
        6,
      );
      rain(62, 4);
      break;
    case 33:
      hills(188);
      repeat(30, () => {
        let x = r(-10, 610),
          y = r(25, 151);
        twig(x + 8, 250, x, y, light, 1.8);
        for (let k = 0; k < 10; k++) {
          let cy = y + k * 6;
          line(
            [
              [x + k * 0.22, cy + 9],
              [x - 9 + k * 0.2, cy - 3],
            ],
            light,
            1,
          );
          line(
            [
              [x + k * 0.22, cy + 6],
              [x + 8 + k * 0.2, cy - 5],
            ],
            light,
            1,
          );
        }
      });
      break;
    case 34:
      sea(175);
      shape(
        [
          [375, 102],
          [135, 69],
          [133, 132],
        ],
        light,
      );
      shape(
        [
          [353, 181],
          [365, 110],
          [380, 110],
          [392, 181],
        ],
        ink,
      );
      ctx.fillStyle = light;
      ctx.fillRect(363, 97, 20, 12);
      shape(
        [
          [358, 97],
          [372, 84],
          [388, 97],
        ],
        ink,
      );
      hill(216, 27, ink, 3);
      rain(97, 10);
      break;
    case 35:
      stars(95);
      sun(406, 57, 18);
      oval(414, 51, 18, 18, sky);
      hill(174, 21, far, 2);
      hill(202, 18, mid, 1);
      for (let i = 0; i < 22; i++) {
        let x = i * 31 + r(-12, 12);
        tree(x, 245 + r(-6, 8), r(28, 109), ink);
      }
      hill(243, 6, ink);
      break;
  }
  // Small foreground details belong to the habitat of each illustration.
  if ([1, 7, 15, 29, 32].includes(index)) {
    for (let j = 0; j < 15; j++) {
      const x = 7 + j * 4,
        y = r(199, 233);
      twig(x, 252, x + r(0, 12), y, ink, 1.2);
      oval(x + 4, y - 2, 1.8, 5, accent, 0.16);
    }
  } else if ([3, 9, 11, 13, 16, 23, 28].includes(index)) {
    for (const [x, y, s] of [
      [440, 51, 4],
      [452, 45, 2.5],
    ]) {
      oval(x - 2, y - 2, s, 1.6, light, -0.8);
      oval(x + 2, y - 2, s, 1.5, light, -0.4);
      oval(x, y, s, 1.6, ink, -0.14);
      line(
        [
          [x, y - 1.3],
          [x, y + 1.1],
        ],
        accent,
        1.3,
      );
    }
  } else if ([0, 4, 30, 33, 35].includes(index)) {
    const x = 547,
      y = 215;
    twig(x - 39, 250, x + 31, y - 48, ink, 1.9);
    for (let k = 0; k < 5; k++) {
      const xx = x + k * 5,
        yy = y - k * 7;
      twig(xx, yy, xx - 8, yy - 9, mid, 1.1);
      oval(xx - 8, yy - 9, 2.2, 2.4, light);
    }
  }
  // A fine paper grain brings the collection together at any display size.
  ctx.globalAlpha = 0.12;
  repeat(2500, () => {
    ctx.fillStyle = r() > 0.48 ? '#fff' : '#332e29';
    ctx.fillRect(r(0, W), r(0, H), r(0.35, 1.3), r(0.35, 1.1));
  });
  ctx.globalAlpha = 1;
}

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
  const [, warm, , mid, ink] = plates[i][1].split(' ').map((s) => '#' + s),
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

export { plates, spotColours, drawPlate, cardPrint };
