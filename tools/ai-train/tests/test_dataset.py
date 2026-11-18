# Tests de lecture des positions et de construction des lots.
import gzip  # fichiers .gz
import json  # format JSON

import pytest  # cadre de test
import torch  # tenseurs

from dataset import collate, load_samples, parse, split_by_game, to_compact
from fake_data import fake_line, fake_meta


def test_parse_compte_les_cartes_statiques():
    meta = fake_meta()
    s = parse(fake_line(0, 1), meta)
    # oppHidden (ensemble 6) : la carte 30 deux fois, la 10 une fois.
    counts = {(int(a), int(b)): int(c) for a, b, c in s.counts}
    assert counts[(6, meta.row_of[30])] == 2
    assert counts[(6, meta.row_of[10])] == 1
    assert len(s.dyn_row) == 0  # aucune carte dynamique


def test_parse_garde_les_cartes_dynamiques():
    s = parse(fake_line(0, 1, dyn=True), fake_meta())
    assert list(s.dyn_set) == [0]  # myMonsters
    assert s.dyn_x.shape == (1, 32)


def test_parse_refuse_une_autre_version():
    line = fake_line(0, 1)
    line["v"] = 2
    with pytest.raises(ValueError):
        parse(line, fake_meta())


def test_split_par_partie_sans_fuite():
    meta = fake_meta()
    samples = [parse(fake_line(g, 1), meta) for g in range(30) for _ in range(3)]
    train, val = split_by_game(samples)
    train_games = {s.g for s in train}
    val_games = {s.g for s in val}
    assert val_games == {0, 10, 20}
    assert not train_games & val_games  # aucune partie des deux côtés


def test_collate_formes():
    meta = fake_meta()
    batch = collate([parse(fake_line(0, 1, dyn=True), meta), parse(fake_line(1, -1), meta)], meta)
    assert batch["global"].shape == (2, 22)
    assert batch["counts"].shape == (2, 7, 4)  # 3 cartes + ligne 0
    assert batch["dyn_x"].shape == (2, 1, 32)
    assert batch["dyn_mask"].tolist() == [[1.0], [0.0]]
    assert batch["y"].tolist() == [1.0, -1.0]


def test_lecture_gzip_et_retour_au_format_compact(tmp_path):
    meta = fake_meta()
    path = tmp_path / "part-0.jsonl.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write(json.dumps(fake_line(3, 1, dyn=True)) + "\n")
    [s] = load_samples([path], meta)
    compact = to_compact(s, meta)
    assert sorted(c["i"] for c in compact["sets"]["oppHidden"]) == [10, 30, 30]
    assert compact["sets"]["myMonsters"][0]["i"] == 20
