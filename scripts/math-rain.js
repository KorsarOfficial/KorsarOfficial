/**
 * Math Rain — animated SVG contribution graph
 * Generates a "matrix rain" of mathematical symbols falling through
 * your GitHub contribution grid. More commits = more intense rain.
 */

const https = require('https');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────

const USERNAME = process.env.GITHUB_USERNAME || 'KorsarOfficial';
const TOKEN = process.env.GITHUB_TOKEN || '';
const OUTPUT_DARK = process.env.OUTPUT_DARK || 'dist/math-rain-dark.svg';
const OUTPUT_LIGHT = process.env.OUTPUT_LIGHT || 'dist/math-rain-light.svg';

const SYMBOLS = [
  '∑', '∫', '∂', '∏', 'π', 'e', 'φ', 'λ', 'Δ', '∇',
  '∞', '√', 'ℝ', 'ℤ', 'ℕ', '∈', '∀', '∃', '⊂', '∪',
  '∩', '⊕', '⊗', '≡', '≈', '≠', '≤', '≥', '→', '⇒',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'f', 'g', 'x', 'y', 'n', 'i', 'α', 'β', 'γ', 'θ',
  'σ', 'μ', 'ω', 'ε', 'δ', 'ζ', 'η', 'ξ', 'ρ', 'τ',
];

const CELL_SIZE = 14;
const CELL_GAP = 3;
const COLS = 53;    // weeks in a year
const ROWS = 7;     // days in a week
const PADDING = 30;
const GRID_W = COLS * (CELL_SIZE + CELL_GAP);
const GRID_H = ROWS * (CELL_SIZE + CELL_GAP);
const SVG_W = GRID_W + PADDING * 2;
const SVG_H = GRID_H + PADDING * 2 + 120; // extra space for rain above

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

// ── SVG Generation ──────────────────────────────────────────────────────────

function getIntensity(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function generateRainDrops(weekIdx, dayIdx, intensity, theme) {
  if (intensity === 0) return '';

  const cx = PADDING + weekIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
  const gridTop = PADDING + 100;
  const cellY = gridTop + dayIdx * (CELL_SIZE + CELL_GAP);

  const numDrops = intensity + 1;
  let drops = '';

  const colors = theme === 'dark'
    ? ['#1a4f2a', '#2ea043', '#40c463', '#58a6ff', '#79c0ff']
    : ['#9be9a8', '#40c463', '#30a14e', '#216e39', '#0969da'];

  for (let d = 0; d < numDrops; d++) {
    const sym = randomSymbol();
    const color = colors[Math.min(intensity, colors.length - 1)];
    const startY = -20 - d * 35 - Math.random() * 60;
    const endY = cellY + CELL_SIZE / 2;
    const duration = 3 + Math.random() * 4;
    const delay = Math.random() * 8 + d * 0.5;
    const fontSize = 9 + intensity * 1.5;
    const opacity = 0.3 + intensity * 0.15;

    drops += `
    <text x="${cx}" y="${startY}"
          font-family="JetBrains Mono, monospace" font-size="${fontSize}"
          fill="${color}" text-anchor="middle" opacity="0">
      ${sym}
      <animate attributeName="y" from="${startY}" to="${endY}"
               dur="${duration}s" begin="${delay}s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;${opacity};${opacity};0"
               keyTimes="0;0.1;0.8;1" dur="${duration}s" begin="${delay}s" repeatCount="indefinite" />
    </text>`;
  }

  return drops;
}

function generateGridCell(weekIdx, dayIdx, intensity, theme) {
  const x = PADDING + weekIdx * (CELL_SIZE + CELL_GAP);
  const y = PADDING + 100 + dayIdx * (CELL_SIZE + CELL_GAP);

  const darkColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const lightColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const colors = theme === 'dark' ? darkColors : lightColors;
  const color = colors[intensity];

  return `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" fill="${color}" />`;
}

function generateSVG(calendar, theme) {
  const bg = theme === 'dark' ? '#0d1117' : '#ffffff';
  const titleColor = theme === 'dark' ? '#58a6ff' : '#0969da';
  const subtitleColor = theme === 'dark' ? '#8b949e' : '#57606a';
  const total = calendar.totalContributions;
  const weeks = calendar.weeks;

  let gridCells = '';
  let rainDrops = '';

  // Build grid from last 53 weeks
  const recentWeeks = weeks.slice(-COLS);

  for (let w = 0; w < recentWeeks.length; w++) {
    const days = recentWeeks[w].contributionDays;
    for (let d = 0; d < days.length; d++) {
      const count = days[d].contributionCount;
      const intensity = getIntensity(count);

      gridCells += generateGridCell(w, d, intensity, theme);

      // Rain drops fall from active cells
      if (intensity > 0) {
        rainDrops += generateRainDrops(w, d, intensity, theme);
      }
    }
  }

  // Title formula
  const titleY = PADDING + 20;
  const formulaY = PADDING + 50;

  // Glow filter for rain
  const glowColor = theme === 'dark' ? '#58a6ff' : '#0969da';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="grid-clip">
      <rect x="${PADDING - 5}" y="${PADDING + 90}" width="${GRID_W + 10}" height="${GRID_H + 20}" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="${bg}" rx="6"/>

  <!-- Title -->
  <text x="${SVG_W / 2}" y="${titleY}"
        font-family="JetBrains Mono, monospace" font-size="14" font-weight="bold"
        fill="${titleColor}" text-anchor="middle">
    ∑ contributions(t) = ${total}
  </text>
  <text x="${SVG_W / 2}" y="${formulaY}"
        font-family="JetBrains Mono, monospace" font-size="11"
        fill="${subtitleColor}" text-anchor="middle">
    where t ∈ [${recentWeeks[0]?.contributionDays[0]?.date || '?'}, now]
  </text>

  <!-- Grid -->
  ${gridCells}

  <!-- Rain (clipped to grid area) -->
  <g clip-path="url(#grid-clip)" filter="url(#glow)">
    ${rainDrops}
  </g>

  <!-- Bottom formula -->
  <text x="${SVG_W / 2}" y="${SVG_H - 15}"
        font-family="JetBrains Mono, monospace" font-size="10"
        fill="${subtitleColor}" text-anchor="middle">
    P(commit | day) &gt; 0  ⟹  ∂(knowledge)/∂(time) &gt; 0
  </text>
</svg>`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);
  const calendar = await fetchContributions();
  console.log(`Total contributions: ${calendar.totalContributions}`);

  // Create output directory
  const outDir = OUTPUT_DARK.substring(0, OUTPUT_DARK.lastIndexOf('/'));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Generate dark theme
  const darkSvg = generateSVG(calendar, 'dark');
  fs.writeFileSync(OUTPUT_DARK, darkSvg);
  console.log(`Written: ${OUTPUT_DARK}`);

  // Generate light theme
  const lightSvg = generateSVG(calendar, 'light');
  fs.writeFileSync(OUTPUT_LIGHT, lightSvg);
  console.log(`Written: ${OUTPUT_LIGHT}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
