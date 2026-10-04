// Terminal rendering helpers for bin.js: banner, boxes, spinner, pipeline
// diagram, YAML highlighting. Pure ANSI, no dependencies. Every helper
// degrades to plain ASCII-art text when color is off (NO_COLOR, non-TTY,
// --no-color), so piping the output into a file or CI log stays readable.

const env = process.env;

export function colorLevel(stream = process.stdout) {
  if ('NO_COLOR' in env) return 0;
  if (env.FORCE_COLOR === '0') return 0;
  if (!stream.isTTY && !env.FORCE_COLOR) return 0;
  if (/truecolor|24bit/i.test(env.COLORTERM || '')) return 3;
  if (/-256(color)?$/i.test(env.TERM || '')) return 2;
  return env.FORCE_COLOR === '3' ? 3 : 2;
}

let level = colorLevel();
export function setColor(enabled) {
  level = enabled ? Math.max(colorLevel(), 2) : 0;
}

const sgr = (open, close) => (s) => (level ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
export const c = {
  bold: sgr(1, 22),
  dim: sgr(2, 22),
  italic: sgr(3, 23),
  underline: sgr(4, 24),
  red: sgr(31, 39),
  green: sgr(32, 39),
  yellow: sgr(33, 39),
  blue: sgr(34, 39),
  magenta: sgr(35, 39),
  cyan: sgr(36, 39),
  gray: sgr(90, 39),
};

function rgbTo256(r, g, b) {
  const q = (v) => Math.round((v / 255) * 5);
  return 16 + 36 * q(r) + 6 * q(g) + q(b);
}

export function rgb(r, g, b) {
  return (s) => {
    if (!level) return String(s);
    const code = level === 3 ? `38;2;${r};${g};${b}` : `38;5;${rgbTo256(r, g, b)}`;
    return `\x1b[${code}m${s}\x1b[39m`;
  };
}

// Brand gradient: cyan → violet → pink.
const STOPS = [
  [0, 229, 255],
  [124, 77, 255],
  [255, 45, 149],
];

function gradientAt(t) {
  const seg = Math.min(STOPS.length - 2, Math.floor(t * (STOPS.length - 1)));
  const local = t * (STOPS.length - 1) - seg;
  const [a, b] = [STOPS[seg], STOPS[seg + 1]];
  return a.map((v, i) => Math.round(v + (b[i] - v) * local));
}

/** Colors each visible character of a plain string along the brand gradient. */
export function gradient(text, { offset = 0, span } = {}) {
  if (!level) return text;
  const chars = [...text];
  const total = span ?? chars.length;
  return chars
    .map((ch, i) => (ch === ' ' ? ch : rgb(...gradientAt(Math.min(1, (i + offset) / Math.max(1, total - 1))))(ch)))
    .join('');
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;
export const stripAnsi = (s) => String(s).replace(ANSI_RE, '');
export const visibleWidth = (s) => [...stripAnsi(s)].length;
export const padEnd = (s, width) => s + ' '.repeat(Math.max(0, width - visibleWidth(s)));

// ─── Banner ─────────────────────────────────────────────────────────────────

// "ANSI Shadow" figlet font, only the glyphs the banner needs. Each glyph's
// rows share one width so letters can be concatenated column by column.
const FONT = {
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  H: ['██╗  ██╗', '██║  ██║', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  W: ['██╗    ██╗', '██║    ██║', '██║ █╗ ██║', '██║███╗██║', '╚███╔███╔╝', ' ╚══╝╚══╝ '],
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  X: ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝'],
};

/** Renders `word` in the ANSI Shadow font; returns one string per row. */
export function bigText(word) {
  const glyphs = [...word.toUpperCase()].map((ch) => {
    if (!FONT[ch]) throw new Error(`bigText: no glyph for "${ch}"`);
    return FONT[ch];
  });
  return FONT.S.map((_, r) => glyphs.map((g) => g[r]).join('').replace(/\s+$/, ''));
}

export function banner({ version, tagline, columns = process.stdout.columns || 80 }) {
  const sub = `${c.bold('/code')} ${c.gray('·')} ${c.gray(tagline)} ${c.gray('·')} ${c.dim(`v${version}`)}`;
  const lines = bigText('shadownrx');
  // Narrow terminal: the 77-column logo would wrap into garbage.
  if (columns < Math.max(...lines.map((l) => [...l].length)) + 2) {
    return ['', `  ${gradient('▲ shadownrx')}${sub}`, ''].join('\n');
  }
  const width = Math.max(...lines.map((l) => [...l].length));
  const art = lines.map((line) => {
    if (!level) return line;
    return [...line]
      .map((ch, i) => {
        if (ch === ' ') return ch;
        const paint = rgb(...gradientAt(i / (width - 1)));
        // Solid blocks in full color, the box-drawing "shadow" dimmed.
        return ch === '█' ? paint(ch) : c.dim(paint(ch));
      })
      .join('');
  });
  return ['', ...art.map((l) => '  ' + l), '  ' + sub, ''].join('\n');
}

// ─── Boxes & layout ─────────────────────────────────────────────────────────

const BORDERS = {
  round: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  heavy: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
};

/**
 * Draws a framed panel around `content` (string or array of lines).
 * `color` paints the border; `title` is embedded in the top edge.
 */
export function box(content, { title, color = c.gray, style = 'round', padding = 1, minWidth = 0 } = {}) {
  const b = BORDERS[style];
  const lines = (Array.isArray(content) ? content : String(content).split('\n'));
  const titleWidth = title ? visibleWidth(title) + 4 : 0;
  const inner = Math.max(minWidth, titleWidth, ...lines.map((l) => visibleWidth(l) + padding * 2));
  const pad = ' '.repeat(padding);

  let top;
  if (title) {
    const head = `${b.h} ${title} `;
    top = color(b.tl + b.h) + c.bold(` ${title} `) + color(b.h.repeat(Math.max(0, inner - visibleWidth(head))) + b.tr);
  } else {
    top = color(b.tl + b.h.repeat(inner) + b.tr);
  }
  const body = lines.map((l) => color(b.v) + padEnd(pad + l, inner) + color(b.v));
  const bottom = color(b.bl + b.h.repeat(inner) + b.br);
  return [top, ...body, bottom].map((l) => '  ' + l).join('\n');
}

/** Two-column key/value rows with the keys right-padded to the same width. */
export function table(rows, { keyColor = c.gray } = {}) {
  const kw = Math.max(...rows.map(([k]) => visibleWidth(k)));
  return rows.map(([k, v]) => `${keyColor(padEnd(k, kw))}  ${v}`);
}

export function progressBar(done, total, width = 24) {
  const filled = Math.round((done / total) * width);
  const bar = '━'.repeat(filled);
  return gradient(bar, { span: width }) + c.gray('─'.repeat(width - filled));
}

export function stepHeader(n, total, title) {
  const label = c.bold(`Paso ${n}/${total}`);
  return `\n  ${progressBar(n - 1, total)}  ${label} ${c.gray('·')} ${title}\n`;
}

export function rule(label = '', width = 64) {
  if (!label) return '  ' + c.gray('─'.repeat(width));
  const tail = Math.max(2, width - visibleWidth(label) - 4);
  return `  ${c.gray('──')} ${label} ${c.gray('─'.repeat(tail))}`;
}

// ─── Spinner ────────────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Runs `task` while showing an animated spinner (TTY only), keeping it
 * visible for at least `minMs` so it doesn't flash by unreadably.
 */
export async function spin(text, task, { minMs = 450, stream = process.stdout } = {}) {
  const started = Date.now();
  let i = 0;
  let timer;
  if (stream.isTTY) {
    stream.write('\x1b[?25l');
    timer = setInterval(() => {
      stream.write(`\r  ${rgb(...gradientAt((i % FRAMES.length) / (FRAMES.length - 1)))(FRAMES[i % FRAMES.length])} ${text}`);
      i++;
    }, 70);
  }
  try {
    const result = await task();
    const left = minMs - (Date.now() - started);
    if (stream.isTTY && left > 0) await new Promise((r) => setTimeout(r, left));
    return result;
  } finally {
    if (timer) {
      clearInterval(timer);
      stream.write('\r\x1b[2K\x1b[?25h');
    }
  }
}

export const sym = {
  ok: () => c.green('✔'),
  fail: () => c.red('✖'),
  warn: () => c.yellow('▲'),
  info: () => c.cyan('●'),
  arrow: () => c.gray('›'),
  dot: () => c.gray('·'),
};

// ─── Pipeline diagram ───────────────────────────────────────────────────────

/**
 * ASCII flow of the jobs build-mobile.yml will run for this configuration,
 * mirroring the real job graph (detect → build-* → notify).
 */
export function pipeline({ projectType, buildAndroid, buildIos, createRelease }) {
  const jobs = [];
  if (projectType === 'electron') {
    jobs.push(['electron · linux', 'ubuntu', '.AppImage']);
    jobs.push(['electron · macos', 'macos', '.dmg']);
    jobs.push(['electron · windows', 'windows', '.exe']);
  } else {
    if (buildAndroid) jobs.push(['build-android', 'ubuntu', '.apk  .aab']);
    if (buildIos) jobs.push(['build-ios', 'macos', '.ipa']);
  }

  const JOB = 20;
  const RUN = 10;
  const node = (glyph, name, run, note) =>
    `${padEnd(glyph, 4)}${c.bold(padEnd(name, JOB))}${c.gray(padEnd(`[${run}]`, RUN))} ${note}`;
  const pipe = c.gray('│');

  const lines = [
    `${padEnd(c.cyan('◉'), 4)}${c.bold(padEnd('git push', JOB + RUN))} ${c.gray('main · PR · tags v* · manual')}`,
    pipe,
    node(c.cyan('◆'), 'detect', 'ubuntu', c.gray(`project_type: ${projectType}`)),
    pipe,
    ...jobs.map(([name, run, out]) => node(c.gray('├─▶'), name, run, `${c.gray('→')} ${c.green(out)}`)),
    pipe,
    node(c.magenta('◆'), 'notify', 'ubuntu', c.gray('resumen · Slack opcional')),
  ];
  if (createRelease) lines.push(`${padEnd(c.gray('└─▶'), 4)}${c.yellow(padEnd('GitHub Release', JOB + RUN))} ${c.gray('adjunta los builds en tags v*')}`);
  return lines;
}

// ─── YAML highlighting ──────────────────────────────────────────────────────

/** Minimal line-based YAML coloring, enough for the workflow we generate. */
export function highlightYaml(yaml) {
  return yaml
    .replace(/\n$/, '')
    .split('\n')
    .map((line, i) => {
      const num = c.gray(String(i + 1).padStart(2, ' ') + ' │ ');
      if (!level) return num + line;
      if (/^\s*#/.test(line)) return num + c.gray(line);
      const m = line.match(/^(\s*)(-\s+)?([\w.-]+)(:)(\s*)(.*)$/);
      if (!m) return num + line;
      const [, ind, dash = '', key, colon, sp, value] = m;
      let v = value;
      if (/^(true|false)$/.test(value)) v = c.magenta(value);
      else if (/^\[.*\]$/.test(value)) v = c.yellow(value);
      else if (/^["']/.test(value)) v = c.yellow(value);
      else if (value) v = c.green(value);
      return num + ind + c.gray(dash) + c.cyan(key) + c.gray(colon) + sp + v;
    })
    .join('\n');
}
