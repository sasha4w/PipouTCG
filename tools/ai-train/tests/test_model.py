# Tests du réseau de valeur.
import torch  # tenseurs

from dataset import collate, parse
from fake_data import fake_line, fake_meta
from model import ValueNet


def make_model(meta):
    torch.manual_seed(0)  # poids initiaux reproductibles
    return ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)


def test_sortie_dans_moins_un_un():
    meta = fake_meta()
    batch = collate([parse(fake_line(g, 1, dyn=g % 2 == 0), meta) for g in range(5)], meta)
    out = make_model(meta)(batch)
    assert out.shape == (5,)
    assert bool(((out > -1) & (out < 1)).all())


def test_carte_statique_comptee_ou_listee_meme_valeur():
    # Une carte statique peut passer par les comptes ou par la liste dynamique :
    # la somme DeepSets doit donner le même résultat (l'inférence TS s'appuie dessus).
    meta = fake_meta()
    counted = fake_line(0, 1)
    listed = fake_line(0, 1)
    listed["sets"]["myHand"] = [{"i": 10, "x": meta.static_x[meta.row_of[10]].tolist()}, {"i": 20}]
    model = make_model(meta).double()
    a = model(collate([parse(counted, meta)], meta, dtype=torch.float64))
    b = model(collate([parse(listed, meta)], meta, dtype=torch.float64))
    assert torch.allclose(a, b, atol=1e-12)


def test_ordre_des_cartes_sans_effet():
    meta = fake_meta()
    line = fake_line(0, 1)
    reverse = fake_line(0, 1)
    reverse["sets"]["oppHidden"] = list(reversed(reverse["sets"]["oppHidden"]))
    model = make_model(meta)
    a = model(collate([parse(line, meta)], meta))
    b = model(collate([parse(reverse, meta)], meta))
    assert torch.allclose(a, b)


def test_nombre_de_parametres_raisonnable():
    model = make_model(fake_meta())
    total = sum(p.numel() for p in model.parameters())
    assert 40_000 < total < 70_000
