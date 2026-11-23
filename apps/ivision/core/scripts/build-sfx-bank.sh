#!/usr/bin/env bash
# LA BANQUE DE SONS EARSHOT — à lancer une fois, sur un poste où Earshot est installé (MIT, https://github.com/Leonxlnx/earshot) :
#
#   pip install "earshot @ git+https://github.com/Leonxlnx/earshot"
#   bash apps/ivision/core/scripts/build-sfx-bank.sh
#
# Avec Python 3.9 (macOS) : la copie locale `.earshot-src/` (ignorée par git) accepte 3.9 et se passe de numba —
#   python3 -m venv .venv-earshot && source .venv-earshot/bin/activate && python3 -m pip install ./.earshot-src
#
# Earshot rend chaque son par du code (aucun fichier audio téléchargé), une nouvelle prise à chaque appel, sur le
# processeur. Le script écrit trois prises par moment sonore du moteur vidéo dans `apps/ivision/core/assets/sfx-bank/`
# et leur `index.json` ; le moteur (`audio/sfx.ts#bankSounds`) les sert en ligne comme hors ligne, avant la synthèse.
set -eo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/sfx-bank"
mkdir -p "$OUT"
command -v earshot >/dev/null || { echo "earshot introuvable : pip install \"earshot @ git+https://github.com/Leonxlnx/earshot\""; exit 1; }

make_sound() { earshot make "$2" -o "$OUT/$1.wav"; }
make_sound whoosh     "three variations of a fast clean air whoosh for a video cut"
make_sound softwhoosh "three variations of a soft gentle swish"
make_sound pop        "three variations of a short soft interface pop"
make_sound click      "three variations of a soft interface click"
make_sound tick       "three variations of a tiny clean tick"
make_sound impact     "three variations of a deep cinematic hit for a logo"
make_sound shimmer    "three variations of a bright short sparkle shimmer"
make_sound riser      "three variations of a short tension riser"

node -e '
const fs = require("fs"), path = require("path");
const dir = process.argv[1];
const index = {};
for (const f of fs.readdirSync(dir).filter((x) => /\.(ogg|wav|mp3)$/.test(x)).sort()) {
  const kind = f.replace(/(_\d+)?\.(ogg|wav|mp3)$/, "");
  (index[kind] ??= []).push({ file: f, title: `${kind} (earshot)`, author: "earshot", license: "generated" });
}
fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`✓ ${Object.values(index).flat().length} sons dans ${dir}/index.json`);
' "$OUT"
