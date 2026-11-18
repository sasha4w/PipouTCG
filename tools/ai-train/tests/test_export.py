# Tests de l'export JSON : forme, relecture à l'identique, parité.
import json  # format JSON

import torch  # tenseurs

from dataset import collate, parse
from export import export_weights, model_from_json, round6
from fake_data import fake_line, fake_meta
from model import ValueNet


def setup():
    meta = fake_meta()
    torch.manual_seed(0)
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)
    samples = [parse(fake_line(g, 1, dyn=g % 2 == 0), meta) for g in range(6)]
    return meta, model, samples


def test_forme_du_fichier(tmp_path):
    meta, model, samples = setup()
    path = tmp_path / "w.json"
    data = export_weights(model, meta, generation=3, positions=6, val_loss=0.5, parity_samples=samples, path=path)
    assert json.loads(path.read_text(encoding="utf-8")) == data
    assert data["encodingVersion"] == 1
    assert data["cardIndex"] == {"10": 1, "20": 2, "30": 3}
    assert len(data["layers"]["emb"]) == 4
    assert len(data["layers"]["head1"]["w"][0]) == 22 + 7 * 32
    assert len(data["parity"]["positions"]) == 6


def test_relu_a_l_identique():
    meta, model, samples = setup()
    data = export_weights(model, meta, generation=0, positions=0, val_loss=0, parity_samples=samples)
    back = model_from_json(data, meta)
    with torch.no_grad():
        values = back(collate(samples, meta, dtype=torch.float64)).tolist()
    assert values == data["parity"]["values"]


def test_arrondi_a_6_chiffres():
    assert round6(0.123456789) == 0.123457
    assert round6(-1.5e-9) == -1.5e-9
