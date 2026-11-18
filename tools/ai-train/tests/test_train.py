# Tests de l'entraînement : la perte baisse, la reprise repart du checkpoint.
from dataset import parse, split_by_game
from fake_data import fake_line, fake_meta
from train import evaluate, train


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
