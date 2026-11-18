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


def test_kill_tree_tue_les_petits_enfants(tmp_path):
    import subprocess, sys, time  # processus, interpréteur, attente
    import loop
    pid_file = tmp_path / "child.pid"  # le parent y écrit le pid de son enfant
    code = ("import subprocess,sys,time;"
            "c=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)']);"
            f"open(r'{pid_file}','w').write(str(c.pid));time.sleep(60)")
    parent = subprocess.Popen([sys.executable, "-c", code], **loop.group_flags())
    try:
        for _ in range(100):  # attend l'écriture du pid (10 s au plus)
            if pid_file.exists() and pid_file.read_text():
                break
            time.sleep(0.1)
        child = int(pid_file.read_text())
        loop.kill_tree(parent)
        parent.wait(timeout=10)
        for _ in range(100):  # l'enfant doit disparaître
            if not _alive(child):
                break
            time.sleep(0.1)
        assert not _alive(child)
    finally:
        loop.kill_tree(parent)


def _alive(pid: int) -> bool:
    import os, subprocess
    if os.name == "nt":  # Windows : tasklist liste le pid s'il existe
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)  # signal 0 : teste seulement l'existence
        return True
    except OSError:
        return False


def test_run_command_echec_et_json_invalide(tmp_path):
    import subprocess, sys
    import pytest
    import loop
    with pytest.raises(subprocess.CalledProcessError):
        loop.run_command([sys.executable, "-c", "raise SystemExit(3)"], tmp_path)
    loop.run_command([sys.executable, "-c", "pass"], tmp_path)  # succès : pas d'erreur
    (tmp_path / "a.json").write_text('{"score": 1}', encoding="utf-8")
    with pytest.raises(SystemExit, match="clés manquantes"):
        loop.read_json(tmp_path / "a.json", ("score", "lower"))
    with pytest.raises(SystemExit, match="absent"):
        loop.read_json(tmp_path / "nope.json")
