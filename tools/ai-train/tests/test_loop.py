# tools/ai-train/tests/test_loop.py
# Tests des morceaux de la boucle qui ne lancent pas Node.
import json  # format JSON

from loop import load_state, record_of, save_json, should_promote, write_report


def test_promotion_score_et_wilson():
    assert should_promote({"score": 0.56, "lower": 0.51})
    assert not should_promote({"score": 0.56, "lower": 0.49})  # pas assez sûr
    assert not should_promote({"score": 0.54, "lower": 0.51})  # pas assez fort


def test_etat_initial_puis_relu(tmp_path):
    state = load_state(tmp_path, "essai")
    assert state == {"run": "essai", "generation": 1, "step": "selfplay", "champion": None, "history": []}
    state["step"] = "train"
    save_json(tmp_path / "state.json", state)
    assert load_state(tmp_path, "essai")["step"] == "train"
    assert not (tmp_path / "state.json.tmp").exists()  # écriture atomique


def test_rapport(tmp_path):
    state = load_state(tmp_path, "essai")
    record_of(state, 1).update(positions=100, valLoss=0.8, arena=0.58, promoted=True, gauge=0.61)
    record_of(state, 2).update(positions=120, valLoss=0.7, arena=0.5, promoted=False)
    write_report(tmp_path, state)
    report = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "| 1 | 100 | 0.8000 | 58.0 % | oui | 61.0 % |" in report
    assert (tmp_path / "progression.png").exists()
    json.dumps(state)  # l'état reste sérialisable
