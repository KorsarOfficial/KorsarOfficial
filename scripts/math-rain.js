/**
 * Math Rain v2 — animated SVG contribution graph
 *
 * Symbols fly in from top-left and top-right diagonally.
 * When they collide on active contribution cells, they COMBINE
 * into real mathematical formulas. More commits = more complex formulas.
 *
 * Intensity mapping:
 *   1-2 commits  → simple:  x², n+1, πr
 *   3-5 commits  → medium:  ∑xᵢ, f'(x), ∫dx
 *   6-9 commits  → complex: ∫₀^∞ e⁻ˣ²dx, ∇×F
 *   10+ commits  → elite:   full equations with limits
 */

const https = require('https');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────

const USERNAME = process.env.GITHUB_USERNAME || 'KorsarOfficial';
const TOKEN = process.env.GITHUB_TOKEN || '';
const OUTPUT_DARK = process.env.OUTPUT_DARK || 'dist/math-rain-dark.svg';
const OUTPUT_LIGHT = process.env.OUTPUT_LIGHT || 'dist/math-rain-light.svg';

const CELL_SIZE = 14;
const CELL_GAP = 3;
const COLS = 53;
const ROWS = 7;
const PADDING = 30;
const RAIN_ZONE = 130;
const GRID_W = COLS * (CELL_SIZE + CELL_GAP);
const GRID_H = ROWS * (CELL_SIZE + CELL_GAP);
const SVG_W = GRID_W + PADDING * 2;
const SVG_H = GRID_H + PADDING * 2 + RAIN_ZONE + 40;

// ── Symbols that fly in from left and right ─────────────────────────────────

const LEFT_SYMBOLS = [
  '∑', '∫', '∂', '∏', 'lim', '∇', 'det', 'sup', 'inf', 'log',
  'd/dx', '∮', '∬', 'max', 'min',
];

const RIGHT_SYMBOLS = [
  'x²', 'eⁿ', 'πr', 'n!', 'λx', 'φ(n)', 'sin θ', 'cos ω',
  'ln x', '√n', 'aⁿ', 'rⁿ', 'xⁱ', 'tⁿ', 'f(x)',
];

// ── Formulas that appear on collision (by intensity) ────────────────────────

const FORMULAS = {
  1: [
    'x+1', 'n²', '2πr', 'a+b', 'x·y', 'n!', 'eˣ', 'log n',
    'sin x', 'cos θ', 'tan φ', '|x|', 'a/b', 'xⁿ', '√2',
  ],
  2: [
    '∑xᵢ', "f'(x)", '∫dx', 'n log n', 'e^(iπ)', '∂f/∂x', 'x→∞',
    'Δx→0', '∏aᵢ', 'a·b=|a||b|cosθ', 'P(A|B)', 'λe^(-λx)',
    '∇f', '∑1/n²', 'n·(n+1)/2',
  ],
  3: [
    '∫₀^∞ e⁻ˣdx=1', '∑ᵢ₌₁ⁿ i=n(n+1)/2', '∇×F=0', 'det(A)≠0',
    'lim[sin(x)/x]=1', '∂²f/∂x²+∂²f/∂y²=0', 'e^(iπ)+1=0',
    '∫₋∞^∞ e⁻ˣ²dx=√π', 'P=NP ?', '∑1/n² = π²/6',
    'ζ(s)=∑n⁻ˢ', '∮F·dr=0', 'Ax=λx',
  ],
  4: [
    '∫₀^∞ e⁻ˣ²dx = √π/2',
    '∑ₙ₌₀^∞ xⁿ/n! = eˣ',
    '∇²φ = ρ/ε₀',
    'det(A-λI) = 0',
    'eiπ + 1 = 0',
    '∂L/∂q - d/dt(∂L/∂q̇) = 0',
    'H ψ = E ψ',
    'ds² = -c²dt² + dx²',
    'Rμν - ½gμνR = 8πGTμν',
    '∮ E·dA = Q/ε₀',
  ],
};

// ── Fetch contributions ─────────────────────────────────────────────────────

function fetchContributions() {
  const query = JSON.stringify({
    query: `{
      user(login: "${USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }`
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'math-rain-generator',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors) {
            reject(new Error(JSON.stringify(json.errors)));
            return;
          }
          resolve(json.data.user.contributionsCollection.contributionCalendar);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(query);
    req.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getIntensity(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── SVG Generation ──────────────────────────────────────────────────────────

function cellPos(weekIdx, dayIdx) {
  const x = PADDING + weekIdx * (CELL_SIZE + CELL_GAP);
  const y = PADDING + RAIN_ZONE + dayIdx * (CELL_SIZE + CELL_GAP);
  return { x, y, cx: x + CELL_SIZE / 2, cy: y + CELL_SIZE / 2 };
}

function generateGridCell(weekIdx, dayIdx, intensity, theme) {
  const { x, y } = cellPos(weekIdx, dayIdx);
  const darkColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const lightColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const colors = theme === 'dark' ? darkColors : lightColors;
  return `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" fill="${colors[intensity]}" />`;
}

function generateCollision(weekIdx, dayIdx, intensity, theme, index) {
  if (intensity === 0) return '';

  const { cx, cy } = cellPos(weekIdx, dayIdx);
  const gridTop = PADDING + RAIN_ZONE;

  // ── Colors by theme ──
  const accentColors = theme === 'dark'
    ? ['#2ea043', '#40c463', '#58a6ff', '#79c0ff']
    : ['#40c463', '#30a14e', '#0969da', '#0550ae'];
  const dimColor = theme === 'dark' ? '#484f58' : '#8b949e';
  const accent = accentColors[Math.min(intensity - 1, accentColors.length - 1)];

  // ── Timing ──
  // Stagger animations so not everything fires at once
  const baseDelay = (index * 0.37) % 12;
  const flyDuration = 2.5 + Math.random() * 1.5;
  const formulaDuration = 8 + Math.random() * 4;

  let svg = '';

  // ── Left incoming symbol ──
  const leftSym = escapeXml(pick(LEFT_SYMBOLS));
  const leftStartX = cx - 120 - Math.random() * 80;
  const leftStartY = gridTop - 40 - Math.random() * 60;

  svg += `
    <text font-family="JetBrains Mono, monospace" font-size="10"
          fill="${dimColor}" text-anchor="middle" opacity="0">
      ${leftSym}
      <animate attributeName="x" values="${leftStartX};${cx}" dur="${flyDuration}s"
               begin="${baseDelay}s" repeatCount="indefinite" />
      <animate attributeName="y" values="${leftStartY};${cy}" dur="${flyDuration}s"
               begin="${baseDelay}s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.6;0.6;0"
               keyTimes="0;0.15;0.75;1" dur="${flyDuration}s"
               begin="${baseDelay}s" repeatCount="indefinite" />
    </text>`;

  // ── Right incoming symbol ──
  const rightSym = escapeXml(pick(RIGHT_SYMBOLS));
  const rightStartX = cx + 120 + Math.random() * 80;
  const rightStartY = gridTop - 30 - Math.random() * 70;

  svg += `
    <text font-family="JetBrains Mono, monospace" font-size="10"
          fill="${dimColor}" text-anchor="middle" opacity="0">
      ${rightSym}
      <animate attributeName="x" values="${rightStartX};${cx}" dur="${flyDuration}s"
               begin="${baseDelay}s" repeatCount="indefinite" />
      <animate attributeName="y" values="${rightStartY};${cy}" dur="${flyDuration}s"
               begin="${baseDelay}s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.6;0.6;0"
               keyTimes="0;0.15;0.75;1" dur="${flyDuration}s"
               begin="${baseDelay}s" repeatCount="indefinite" />
    </text>`;

  // ── Combined formula appears at cell after collision ──
  const formula = escapeXml(pick(FORMULAS[intensity] || FORMULAS[1]));
  const formulaDelay = baseDelay + flyDuration * 0.85;
  const fontSize = intensity <= 2 ? 8 : (intensity === 3 ? 7 : 6.5);

  // Formula floats up slightly after appearing
  svg += `
    <text x="${cx}" font-family="JetBrains Mono, monospace" font-size="${fontSize}"
          fill="${accent}" text-anchor="middle" opacity="0" filter="url(#glow)">
      ${formula}
      <animate attributeName="y" values="${cy};${cy - 18}" dur="${formulaDuration}s"
               begin="${formulaDelay}s" repeatCount="indefinite" />
      <animate attributeName="opacity"
               values="0;0;1;1;0"
               keyTimes="0;0.01;0.08;0.7;1"
               dur="${formulaDuration}s" begin="${formulaDelay}s" repeatCount="indefinite" />
    </text>`;

  // ── Collision flash ──
  svg += `
    <circle cx="${cx}" cy="${cy}" r="0" fill="${accent}" opacity="0">
      <animate attributeName="r" values="0;12;0" dur="0.8s"
               begin="${formulaDelay}s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.3;0" dur="0.8s"
               begin="${formulaDelay}s" repeatCount="indefinite" />
    </circle>`;

  return svg;
}

// ── Ambient floating symbols (background decoration) ────────────────────────

function generateAmbient(theme) {
  const ambientSyms = ['∑', '∫', '∂', 'π', 'e', '∞', '∇', 'φ', 'λ', 'Δ', 'α', 'β', 'θ', 'ω', 'ε'];
  const color = theme === 'dark' ? '#21262d' : '#d0d7de';
  let svg = '';

  for (let i = 0; i < 25; i++) {
    const sym = pick(ambientSyms);
    const x = Math.random() * SVG_W;
    const startY = -20;
    const endY = SVG_H + 20;
    const dur = 15 + Math.random() * 20;
    const delay = Math.random() * 15;
    const size = 10 + Math.random() * 8;

    svg += `
    <text x="${x}" y="${startY}"
          font-family="JetBrains Mono, monospace" font-size="${size}"
          fill="${color}" text-anchor="middle" opacity="0.15">
      ${sym}
      <animate attributeName="y" from="${startY}" to="${endY}"
               dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
    </text>`;
  }

  return svg;
}

// ── Main SVG assembly ───────────────────────────────────────────────────────

function generateSVG(calendar, theme) {
  const bg = theme === 'dark' ? '#0d1117' : '#ffffff';
  const titleColor = theme === 'dark' ? '#58a6ff' : '#0969da';
  const subtitleColor = theme === 'dark' ? '#8b949e' : '#57606a';
  const total = calendar.totalContributions;
  const weeks = calendar.weeks;
  const recentWeeks = weeks.slice(-COLS);

  let gridCells = '';
  let collisions = '';
  let cellIndex = 0;

  for (let w = 0; w < recentWeeks.length; w++) {
    const days = recentWeeks[w].contributionDays;
    for (let d = 0; d < days.length; d++) {
      const count = days[d].contributionCount;
      const intensity = getIntensity(count);
      gridCells += generateGridCell(w, d, intensity, theme);

      if (intensity > 0) {
        collisions += generateCollision(w, d, intensity, theme, cellIndex);
        cellIndex++;
      }
    }
  }

  const ambient = generateAmbient(theme);

  const titleY = PADDING + 25;
  const formulaY = PADDING + 48;
  const gridTop = PADDING + RAIN_ZONE;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="rain-clip">
      <rect x="0" y="${gridTop - 80}" width="${SVG_W}" height="${GRID_H + 100}" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="${bg}" rx="6"/>

  <!-- Ambient background symbols -->
  ${ambient}

  <!-- Title -->
  <text x="${SVG_W / 2}" y="${titleY}"
        font-family="JetBrains Mono, monospace" font-size="14" font-weight="bold"
        fill="${titleColor}" text-anchor="middle">
    ∑ contributions(t) = ${total}
  </text>
  <text x="${SVG_W / 2}" y="${formulaY}"
        font-family="JetBrains Mono, monospace" font-size="11"
        fill="${subtitleColor}" text-anchor="middle">
    ← symbols collide on commits → formulas emerge
  </text>

  <!-- Contribution Grid -->
  ${gridCells}

  <!-- Collision animations (clipped) -->
  <g clip-path="url(#rain-clip)">
    ${collisions}
  </g>

  <!-- Bottom formula -->
  <text x="${SVG_W / 2}" y="${SVG_H - 12}"
        font-family="JetBrains Mono, monospace" font-size="10"
        fill="${subtitleColor}" text-anchor="middle">
    ∀ commit(t): ∃ formula(t) | complexity ∝ contributions
  </text>
</svg>`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);
  const calendar = await fetchContributions();
  console.log(`Total contributions: ${calendar.totalContributions}`);

  const outDir = OUTPUT_DARK.substring(0, OUTPUT_DARK.lastIndexOf('/'));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const darkSvg = generateSVG(calendar, 'dark');
  fs.writeFileSync(OUTPUT_DARK, darkSvg);
  console.log(`Written: ${OUTPUT_DARK}`);

  const lightSvg = generateSVG(calendar, 'light');
  fs.writeFileSync(OUTPUT_LIGHT, lightSvg);
  console.log(`Written: ${OUTPUT_LIGHT}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
