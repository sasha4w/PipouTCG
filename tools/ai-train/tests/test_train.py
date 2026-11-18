# Tests de l'entraînement : la perte baisse, la reprise repart du checkpoint.
from dataset import parse, split_by_game
from fake_data import fake_line, fake_meta
import torch
from model import ValueNet
from train import evaluate, save_atomic, train


def data():
    meta = fake_meta()
    # Cible apprenable : la position avec un monstre gagne, l'autre perd.
    samples = [parse(fake_line(g, 1 if g % 2 else -1, dyn=g % 2 == 1), meta) for g in range(60)]
    return (meta, *split_by_game(samples))


def test_la_perte_baisse(tmp_path):
    meta, tr, va = data()
    model, info = train(tr, va, meta, tmp_path, epochs=40, patience=40, batch_size=16, log=lambda m: None)
    assert info["valLoss"] < 0.2  # bien en dessous de 1 (prédire 0 partout)
    assert evaluate(model, va, meta) == info["valLoss"]


def test_reprise_depuis_le_checkpoint(tmp_path):
    meta, tr, va = data()
    logs = []
    train(tr, va, meta, tmp_path, epochs=2, patience=10, batch_size=16, log=logs.append)
    assert len([m for m in logs if m.startswith("époque")]) == 2
    logs.clear()
    _, info = train(tr, va, meta, tmp_path, epochs=4, patience=10, batch_size=16, log=logs.append)
    assert logs[0] == "reprise à l'époque 3"  # les 2 premières ne sont pas refaites
    assert len([m for m in logs if m.startswith("époque")]) == 2
    assert info["epochs"] == 4


def test_aucune_amelioration_ne_plante_pas(tmp_path):
    meta, tr, va = data()
    # best = -1 : aucune perte de validation ne peut faire mieux, best.pt n'est jamais écrit.
    net = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)
    opt = torch.optim.Adam(net.parameters(), lr=1e-3, weight_decay=1e-5)
    save_atomic({"model": net.state_dict(), "optimizer": opt.state_dict(),
                 "progress": {"epoch": 0, "best": -1.0, "bad": 0}}, tmp_path / "checkpoint.pt")
    train(tr, va, meta, tmp_path, epochs=1, patience=5, batch_size=16, log=lambda m: None)
    assert (tmp_path / "best.pt").exists()
