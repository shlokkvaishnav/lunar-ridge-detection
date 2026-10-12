import { barChart, dataTable, lineChart, loadJson, showError } from './charts.js'

const $ = (id) => document.getElementById(id)
const pct = (n, total) => `${((n / total) * 100).toFixed(1)}%`
const IDS = ['chart-methods', 'chart-tiles', 'chart-loss', 'chart-threshold']

try {
  const [analysis, history, best, sweep, evalBest] = await Promise.all([
    loadJson('data/analysis.json'),
    loadJson('data/history.json'),
    loadJson('data/best_epoch.json'),
    loadJson('data/threshold_sweep.json'),
    loadJson('data/eval_best.json'),
  ])

  // Vertices found by each method. The eight-cell table counts every vertex by which of A, B, C found it.
  const cells = analysis.primary_C.eight_cell_table
  const total = Object.values(cells).reduce((a, b) => a + b, 0)
  const found = (letter) => Object.entries(cells).filter(([key]) => key.includes(`${letter}+`)).reduce((a, [, n]) => a + n, 0)
  const bothClassicalMiss = Object.entries(cells).filter(([key]) => key.includes('A-B-')).reduce((a, [, n]) => a + n, 0)
  const methods = [
    { label: 'Phase symmetry (A)', value: found('A'), muted: true },
    { label: 'Hessian filter (B)', value: found('B'), muted: true },
    { label: 'A or B together', value: total - bothClassicalMiss, muted: true },
    { label: 'Deep learning (C)', value: found('C') },
  ]
  barChart($('chart-methods'), {
    caption: `Ridge vertices found, out of ${total}`,
    max: total,
    items: methods.map((m) => ({ ...m, total, text: `${m.value} of ${total} (${pct(m.value, total)})` })),
  })
  dataTable($('chart-methods'), {
    caption: 'Ridge vertices found on the 6-tile benchmark',
    columns: ['Method', 'Found', 'Share of 57'],
    rows: methods.map((m) => [m.label, m.value, pct(m.value, total)]),
  })

  // Per tile, for the early-stopped checkpoint
  const tiles = evalBest.per_tile
  barChart($('chart-tiles'), {
    caption: 'Vertices found per tile, out of the vertices in that tile',
    max: Math.max(...tiles.map((t) => t.truth)),
    items: tiles.map((t) => ({ label: `Tile ${t.id}`, value: t.hits, total: t.truth, text: `${t.hits} of ${t.truth}` })),
  })
  dataTable($('chart-tiles'), {
    caption: `Deep learning, checkpoint from epoch ${best.best_epoch}, threshold 0.5`,
    columns: ['Tile', 'Found', 'Vertices', 'Mask coverage (%)'],
    rows: tiles.map((t) => [t.id, t.hits, t.truth, t.coverage_pct.toFixed(1)]),
  })

  // Training and validation loss
  const epochs = history.train_loss.map((_, i) => i + 1)
  const top = Math.ceil(Math.max(...history.train_loss, ...history.val_loss) * 4) / 4
  lineChart($('chart-loss'), {
    series: [
      { name: 'Training loss', points: epochs.map((e, i) => ({ x: e, y: history.train_loss[i] })) },
      { name: 'Validation loss', points: epochs.map((e, i) => ({ x: e, y: history.val_loss[i] })), dashed: true },
    ],
    xTicks: [1, 10, 20, 30, 40, 50, 60],
    xLabel: 'Epoch',
    yLabel: 'Loss',
    yMax: top,
    yFormat: (v) => v.toFixed(1),
    markers: [{ x: best.best_epoch, text: `Best epoch ${best.best_epoch}` }],
    summary: `Training loss keeps falling. Validation loss is lowest at epoch ${best.best_epoch} and rises after that.`,
  })

  // Recall against the threshold for three checkpoints
  const thresholds = Object.keys(sweep.this_run_best_ep7).map(Number)
  const recall = (run, t) => {
    const [hit, all] = sweep[run][String(t)].recall_frac.split('/').map(Number)
    return (hit / all) * 100
  }
  const runs = [
    { key: 'this_run_best_ep7', name: 'Checkpoint from epoch 7' },
    { key: 'merged_final_ep60', name: 'Final checkpoint, first run', dashed: true },
    { key: 'this_run_final_ep60', name: 'Final checkpoint, second run', dashed: true },
  ]
  lineChart($('chart-threshold'), {
    series: runs.map((r) => ({ name: r.name, dashed: r.dashed, points: thresholds.map((t) => ({ x: t, y: recall(r.key, t) })) })),
    xTicks: thresholds,
    xLabel: 'Probability threshold for a ridge pixel',
    yLabel: 'Vertices found',
    yMax: 100,
    yFormat: (v) => `${v}%`,
    summary: 'Recall changes strongly with the threshold, and differs a lot between checkpoints.',
  })
  dataTable($('chart-threshold'), {
    caption: 'Vertices found by threshold (of 57)',
    columns: ['Threshold', ...runs.map((r) => r.name)],
    rows: thresholds.map((t) => [t, ...runs.map((r) => sweep[r.key][String(t)].recall_frac)]),
  })
} catch (error) {
  for (const id of IDS) showError($(id), error)
}
