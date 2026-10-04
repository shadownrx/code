import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bigText, box, highlightYaml, pipeline, setColor, stripAnsi, visibleWidth } from './ui.js';

test('bigText rows have equal glyph widths per letter', () => {
  const rows = bigText('shadownrx');
  assert.equal(rows.length, 6);
  // Fits an 80-column terminal with the 2-space indent.
  assert.ok(Math.max(...rows.map((r) => [...r].length)) <= 78);
});

test('bigText rejects letters missing from the font', () => {
  assert.throws(() => bigText('zzz'), /no glyph/);
});

test('box lines all share the same visible width, with and without color', () => {
  for (const color of [false, true]) {
    setColor(color);
    const lines = box(['corto', 'una línea bastante más larga', '\x1b[32mverde\x1b[39m'], {
      title: 'Título',
      minWidth: 40,
    }).split('\n');
    const widths = new Set(lines.map(visibleWidth));
    assert.equal(widths.size, 1, `widths differ: ${[...widths]}`);
  }
  setColor(false);
});

test('pipeline lists one branch per enabled job', () => {
  setColor(false);
  const mobile = pipeline({ projectType: 'flutter', buildAndroid: true, buildIos: false, createRelease: false });
  assert.ok(mobile.some((l) => l.includes('build-android')));
  assert.ok(!mobile.some((l) => l.includes('build-ios')));
  assert.ok(!mobile.some((l) => l.includes('GitHub Release')));

  const desktop = pipeline({ projectType: 'electron', createRelease: true });
  assert.equal(desktop.filter((l) => l.includes('electron ·')).length, 3);
  assert.ok(desktop.some((l) => l.includes('GitHub Release')));
});

test('highlightYaml keeps the YAML text intact once colors are stripped', () => {
  setColor(true);
  const yaml = 'jobs:\n  build:\n    with:\n      build_ios: true\n';
  const plain = stripAnsi(highlightYaml(yaml))
    .split('\n')
    .map((l) => l.replace(/^\s*\d+ │ /, ''))
    .join('\n');
  assert.equal(plain + '\n', yaml);
  setColor(false);
});
