#!/usr/bin/env node
/**
 * src/domain/__fixtures__/global_histogram.json を決定的に生成するスクリプト。
 * 実 API アクセスは行わない。指定した μ・σ を持つ離散正規分布のビンを作る。
 *
 * 仕様: docs/design/issue-4-domain-logic.md §7.4
 * `和牌率` の μ・σ のみが Issue 記載の実測値。他の10 metric は合成値。
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'domain', '__fixtures__', 'global_histogram.json');

const N = 1_000_000;
const NB = 100;

function buildBins(min, max, mu, sigma, bins = NB) {
  const step = (max - min) / bins;
  const out = [];
  for (let i = 0; i < bins; i++) {
    const c = min + step * (i + 0.5);
    out.push(
      Math.round(
        ((N * Math.exp(-0.5 * ((c - mu) / sigma) ** 2)) / (sigma * Math.sqrt(2 * Math.PI))) * step,
      ),
    );
  }
  return out;
}

// metric テーブル（min, max, μ指定, σ指定）。§7.4
const METRICS = {
  和牌率: { min: 0, max: 1, mu: 0.2093, sigma: 0.0239 },
  放铳率: { min: 0, max: 1, mu: 0.122, sigma: 0.018 },
  副露率: { min: 0, max: 1, mu: 0.32, sigma: 0.07 },
  立直率: { min: 0, max: 1, mu: 0.195, sigma: 0.029 },
  默听率: { min: 0, max: 1, mu: 0.18, sigma: 0.05 },
  追立率: { min: 0, max: 1, mu: 0.15, sigma: 0.04 },
  一发率: { min: 0, max: 1, mu: 0.098, sigma: 0.016 },
  里宝率: { min: 0, max: 1, mu: 0.135, sigma: 0.023 },
  和了巡数: { min: 0, max: 20, mu: 11.2, sigma: 0.45 },
  打点效率: { min: 0, max: 10000, mu: 1250, sigma: 180 },
  铳点损失: { min: 0, max: 10000, mu: 640, sigma: 110 },
};

const band0 = {};
for (const [metric, { min, max, mu, sigma }] of Object.entries(METRICS)) {
  const group = {
    mean: mu,
    histogramFull: { min, max, bins: buildBins(min, max, mu, sigma) },
  };
  // histogramClamped を 和牌率 にだけ意図的に付ける（clamped があっても使わないことをテストで固定するため）
  if (metric === '和牌率') {
    group.histogramClamped = { min: 0.15, max: 0.28, bins: buildBins(0.15, 0.28, mu, sigma, 30) };
  }
  band0[metric] = group;
}

const output = {
  16: {
    0: band0,
  },
};

writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${OUT_PATH}`);
