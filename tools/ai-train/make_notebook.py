# tools/ai-train/make_notebook.py
"""Génère explore.ipynb (relancer après modification des cellules)."""
import nbformat  # format des notebooks Jupyter (installé avec jupyter)
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook  # fabriques de cellules

cells = [
    new_markdown_cell("# Explorer l'IA\nCharger des parties, entraîner un petit réseau en regardant la perte, "
                      "inspecter les embeddings. Lancer d'abord une génération (`loop.py`) "
                      "ou `ai:selfplay` vers `data/essai`."),
    new_code_cell("from pathlib import Path\nimport shutil\nimport matplotlib.pyplot as plt\nimport numpy as np\nimport torch\n\n"
                  "from dataset import Meta, load_samples, sample_files, split_by_game\n"
                  "from model import ValueNet\nfrom train import train, evaluate"),
    new_markdown_cell("## 1. Charger des positions\nChoisir un dossier de génération."),
    new_code_cell("data_dir = sorted(Path('data').glob('*/gen-*'))[-1]  # dernière génération trouvée\n"
                  "meta = Meta.load(data_dir / 'meta.json')\n"
                  "samples = load_samples(sample_files([data_dir]), meta)\n"
                  "train_s, val_s = split_by_game(samples)\n"
                  "print(data_dir, len(train_s), 'positions d’entraînement,', len(val_s), 'de validation')"),
    new_markdown_cell("## 2. Ce que contient une position"),
    new_code_cell("s = samples[0]\nprint('résultat :', s.y)\n"
                  "for (k, row, n) in s.counts.tolist()[:10]:\n"
                  "    print(meta.set_names[k], 'carte', meta.card_ids[row - 1], '×', n)"),
    new_markdown_cell("## 3. Entraîner sur un petit échantillon\nLa perte de validation doit baisser, "
                      "puis remonter quand le réseau apprend par cœur (sur-apprentissage)."),
    new_code_cell("shutil.rmtree('runs/notebook', ignore_errors=True)  # repart de zéro (sinon l'entraînement reprend)\n"
                  "history = []\n"
                  "model, info = train(train_s[:3000], val_s[:500], meta, Path('runs/notebook'), epochs=15, patience=15,\n"
                  "                    log=history.append)\n"
                  "val = [float(line.split('validation ')[1]) for line in history if line.startswith('époque')]\n"
                  "plt.plot(range(1, len(val) + 1), val, marker='o'); plt.xlabel('époque'); plt.ylabel('perte de validation')"),
    new_markdown_cell("## 4. Cartes jugées proches\nDistance entre embeddings : des cartes au rôle proche "
                      "devraient être voisines."),
    new_code_cell("emb = model.emb.weight.detach().numpy()[1:]  # sans la ligne 0 (inconnue)\n"
                  "norm = emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-9)\n"
                  "similar = norm @ norm.T\n"
                  "card = 0  # indice de la carte étudiée\n"
                  "for k in np.argsort(-similar[card])[1:6]:\n"
                  "    print(meta.card_ids[k], round(float(similar[card, k]), 3))"),
]
nbformat.write(new_notebook(cells=cells), "explore.ipynb")  # écrit le fichier dans le dossier courant
print("explore.ipynb écrit")
