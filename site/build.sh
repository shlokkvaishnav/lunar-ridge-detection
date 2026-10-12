#!/usr/bin/env bash
# Builds the project page into _site/, ready for GitHub Pages. Preview it with:
#   bash site/build.sh && python3 -m http.server --directory _site 8000
# The charts read the result files of this repository. They are copied into _site/data/,
# so the page always shows the numbers that are in results/.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/data
cp -R site/. _site/
rm -f _site/build.sh
for file in \
  results/three_way_vertex_map/analysis.json \
  results/arm_c_early_stopping/history.json \
  results/arm_c_early_stopping/best_epoch.json \
  results/arm_c_early_stopping/threshold_sweep.json \
  results/arm_c_early_stopping/eval_best.json; do
  cp "$file" "_site/data/$(basename "$file")"
done
echo "Built _site/"
