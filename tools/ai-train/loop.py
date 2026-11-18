# tools/ai-train/loop.py
"""Boucle d'entraînement AlphaZero-lite, sur un seul PC.

Une génération : auto-jeu (Node) -> entraînement (PyTorch) -> parité -> arène
-> jauge contre evaluate.ts si promu. L'état est sauvé après chaque étape :
relancer la même commande reprend là où on s'était arrêté.

    .venv/Scripts/python loop.py --hours 8
"""
from __future__ import annotations  # annotations de type modernes

import argparse  # arguments de la ligne de commande
import json  # format JSON
import os  # remplacement atomique, nombre de cœurs
import signal  # signaux Unix
import shutil  # copie de fichiers, recherche de pnpm
import subprocess  # lancement des commandes Node
import time  # chronomètre
from datetime import datetime  # horodatage du journal
from pathlib import Path  # chemins

ROOT = Path(__file__).resolve().parent  # tools/ai-train
REPO = ROOT.parent.parent  # racine du monorepo
DEFAULT_GAMES = 1500  # parties par génération ; fixé par la mesure de la tâche 13
KEEP_GENERATIONS = 4  # générations de données gardées pour l'entraînement
PROMOTE_SCORE = 0.55  # score d'arène minimal pour promouvoir


def should_promote(verdict: dict) -> bool:
    """Promu si assez fort (≥ 55 %) et assez sûr (borne basse de Wilson > 50 %)."""
    return verdict["score"] >= PROMOTE_SCORE and verdict["lower"] > 0.5


def save_json(path: Path, data: dict) -> None:
    """Écrit dans un .tmp puis renomme : jamais de fichier à moitié écrit."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def load_state(run_dir: Path, run: str) -> dict:
    """État sauvé, ou état de départ (génération 1, auto-jeu avec evaluate.ts)."""
    path = run_dir / "state.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"run": run, "generation": 1, "step": "selfplay", "champion": None, "history": []}


def record_of(state: dict, n: int) -> dict:
    """Ligne d'historique de la génération n (créée au besoin)."""
    for record in state["history"]:
        if record["generation"] == n:
            return record
    record = {"generation": n}
    state["history"].append(record)
    return record


def _pct(v) -> str:
    """Pourcentage lisible d'un score entre 0 et 1, ou un tiret s'il manque."""
    return "—" if v is None else f"{v * 100:.1f} %"


def write_report(run_dir: Path, state: dict) -> None:
    """report.md (tableau) et progression.png (courbes).

    Écrit le tableau Markdown d'abord (une ligne par génération), puis dessine
    deux courbes : perte de validation, et scores d'arène / de jauge.
    """
    import matplotlib  # graphiques (importé ici : inutile au reste de la boucle)
    matplotlib.use("Agg")  # pas de fenêtre : image seulement
    import matplotlib.pyplot as plt

    rows = sorted(state["history"], key=lambda r: r["generation"])
    lines = [f"# Entraînement « {state['run']} »", "",
             f"Champion : {state['champion'] or 'evaluate.ts (aucun promu)'}", "",
             "| Gén. | Positions | Perte val. | Arène | Promu | Jauge vs evaluate.ts |",
             "|---|---|---|---|---|---|"]
    for r in rows:
        loss = "—" if r.get("valLoss") is None else f"{r['valLoss']:.4f}"
        promoted = {True: "oui", False: "non"}.get(r.get("promoted"), "—")
        lines.append(f"| {r['generation']} | {r.get('positions', '—')} | {loss} | "
                     f"{_pct(r.get('arena'))} | {promoted} | {_pct(r.get('gauge'))} |")
    lines += ["", "![progression](progression.png)", ""]
    (run_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")

    fig, (left, right) = plt.subplots(1, 2, figsize=(10, 4))
    gens = [r["generation"] for r in rows]
    left.plot(gens, [r.get("valLoss") for r in rows], marker="o")
    left.set(title="Perte de validation", xlabel="génération")
    for key, label in (("arena", "arène"), ("gauge", "jauge vs evaluate.ts")):
        points = [(r["generation"], r[key]) for r in rows if r.get(key) is not None]
        if points:
            right.plot(*zip(*points), marker="o", label=label)
    right.axhline(0.5, color="grey", linestyle="--")
    right.set(title="Score", xlabel="génération", ylim=(0, 1))
    if right.get_legend_handles_labels()[0]:  # légende seulement s'il y a des courbes
        right.legend()
    fig.tight_layout()
    fig.savefig(run_dir / "progression.png")
    plt.close(fig)


_PNPM = None  # chemin de pnpm retenu (calculé une seule fois)


def find_pnpm() -> str:
    """Premier pnpm du PATH qui répond à --version (certains shims Windows échouent sur un chemin à espaces)."""
    global _PNPM  # cache du résultat
    if _PNPM:  # déjà trouvé
        return _PNPM
    names = ["pnpm.cmd", "pnpm.exe", "pnpm"] if os.name == "nt" else ["pnpm"]  # noms possibles
    for name in names:  # un nom à la fois : .cmd avant .exe (le shim .exe de nvm casse les chemins à espaces)
        for folder in os.environ.get("PATH", "").split(os.pathsep):  # chaque dossier du PATH
            candidate = Path(folder) / name  # chemin complet
            if not candidate.is_file():  # absent : suivant
                continue
            try:  # le shim fonctionne-t-il vraiment ?
                subprocess.run([str(candidate), "--version"], cwd=REPO, check=True, capture_output=True)
            except (OSError, subprocess.CalledProcessError):  # non : suivant
                continue
            _PNPM = str(candidate)  # retenu
            return _PNPM
    raise SystemExit("pnpm introuvable ou inutilisable dans le PATH")


def kill_tree(proc: subprocess.Popen) -> None:
    """Tue le processus ET tous ses descendants (les workers Node sont des petits-enfants)."""
    if proc.poll() is not None:  # déjà fini : rien à tuer (ses enfants seraient déjà orphelins)
        return
    if os.name == "nt":  # Windows : taskkill /T parcourt l'arbre, /F force
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    else:  # Unix : le groupe de processus entier reçoit SIGKILL
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:  # groupe déjà disparu
            pass


def group_flags() -> dict:
    """Options de Popen qui placent le processus dans son propre groupe (tuable avec ses enfants)."""
    if os.name == "nt":  # Windows : nouveau groupe de processus
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}  # Unix : nouvelle session, le processus est chef de groupe


def run_command(cmd: list, cwd: Path) -> None:
    """Lance une commande ; sur interruption ou erreur, tue tout l'arbre puis attend la fin."""
    proc = subprocess.Popen(cmd, cwd=cwd, **group_flags())  # lancement sans attendre
    try:
        code = proc.wait()  # attend la fin normale
    finally:  # KeyboardInterrupt, SIGTERM converti, exception : toujours nettoyer
        kill_tree(proc)  # sans effet si le processus est fini
        proc.wait()  # récupère le processus (pas de zombie)
    if code != 0:  # échec : arrête la boucle, comme check=True
        raise subprocess.CalledProcessError(code, cmd)


def node(script: str, *args) -> None:
    """Lance un script pnpm du backend ; lève si la commande échoue."""
    run_command([find_pnpm(), "--silent", "--filter", "@pipou/backend", script, *map(str, args)], REPO)


def read_json(path: Path, keys: tuple = ()) -> dict:
    """Lit un JSON produit par Node ; erreur claire s'il manque ou s'il n'a pas les clés attendues."""
    if not path.exists():  # la commande a réussi mais n'a rien écrit
        raise SystemExit(f"fichier attendu absent : {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))  # contenu
    except ValueError as e:  # JSON invalide
        raise SystemExit(f"fichier illisible {path} : {e}")
    missing = [k for k in keys if not isinstance(data, dict) or k not in data]  # clés absentes
    if missing:
        raise SystemExit(f"clés manquantes {missing} dans {path}")
    return data


def copy_atomic(src: Path, dst: Path) -> None:
    """Copie via un .tmp puis renomme : dst n'est jamais à moitié écrit."""
    tmp = dst.with_name(dst.name + ".tmp")  # fichier temporaire voisin
    shutil.copyfile(src, tmp)  # copie complète
    os.replace(tmp, dst)  # remplacement atomique


def say(message: str) -> None:
    """Une ligne de console par étape, horodatée."""
    print(f"{datetime.now():%H:%M} {message}", flush=True)


def gen_name(n: int) -> str:
    """Nom du dossier d'une génération : gen-001, gen-002, ..."""
    return f"gen-{n:03d}"


def run_step(state: dict, args, run_dir: Path, data_root: Path) -> None:
    """Exécute l'étape courante et passe à la suivante.

    Modifie `state` seulement à la fin de l'étape ; l'appelant le sauve ensuite.
    Une étape interrompue est donc refaite entièrement à la reprise.
    """
    from dataset import Meta, load_samples, sample_files, split_by_game  # données
    from export import export_weights  # export JSON
    from train import train  # entraînement

    n, step = state["generation"], state["step"]
    gen_dir = run_dir / gen_name(n)
    gen_dir.mkdir(parents=True, exist_ok=True)
    champion = state["champion"] or "legacy"  # génération 1 : evaluate.ts
    record = record_of(state, n)
    started = time.time()
    minutes = lambda: f"{(time.time() - started) / 60:.0f} min"  # noqa: E731

    if step == "selfplay":
        out = data_root / gen_name(n)
        if out.exists():  # étape interrompue : refaite entièrement
            shutil.rmtree(out)
        node("ai:selfplay", out, "--games", args.games, "--seed", n, "--note", champion,
             "--budget", args.budget, "--workers", args.workers)
        done = read_json(out / "done.json", ("games", "positions"))  # bilan de l'auto-jeu
        record["positions"] = done["positions"]
        say(f"gen {n} · auto-jeu : {done['games']} parties, {done['positions']} positions ({minutes()})")
        state["step"] = "train"
    elif step == "train":
        first = max(1, n - KEEP_GENERATIONS + 1)
        dirs = [data_root / gen_name(k) for k in range(first, n + 1)]
        meta = Meta.load(data_root / gen_name(n) / "meta.json")
        train_samples, val_samples = split_by_game(load_samples(sample_files(dirs), meta))
        log_path = run_dir / "train.log"

        def log(message: str) -> None:  # détails dans un fichier, pas en console
            with log_path.open("a", encoding="utf-8") as f:
                f.write(f"{datetime.now():%Y-%m-%d %H:%M} gen {n} {message}\n")

        model, info = train(train_samples, val_samples, meta, gen_dir, log=log)
        export_weights(model, meta, generation=n, positions=len(train_samples), val_loss=info["valLoss"],
                       parity_samples=val_samples, path=gen_dir / "weights.json")
        record["valLoss"] = info["valLoss"]
        say(f"gen {n} · entraînement : perte de validation {info['valLoss']:.4f}, "
            f"{info['epochs']} époques ({minutes()})")
        state["step"] = "parity"
    elif step == "parity":
        node("ai:check-weights", gen_dir / "weights.json")  # lève si l'écart dépasse 1e-5
        state["step"] = "arena"
    elif step == "arena":
        out = gen_dir / "arena.json"
        node("ai:arena", "--challenger", gen_dir / "weights.json", "--champion", champion,
             "--games", args.arena_games, "--seed", n, "--budget", args.budget,
             "--workers", args.workers, "--json", out)
        verdict = read_json(out, ("score", "lower"))  # verdict de l'arène
        promoted = should_promote(verdict)
        record.update(arena=verdict["score"], promoted=promoted)
        if promoted:
            # Le champion est le weights.json de la génération (jamais réécrit), donc une reprise
            # après interruption compare toujours au vrai champion précédent, pas au challenger.
            state["champion"] = str(gen_dir / "weights.json")
            copy_atomic(gen_dir / "weights.json", run_dir / "champion.json")  # copie pratique, atomique
        say(f"gen {n} · arène {verdict['score'] * 100:.1f} % → {'promu' if promoted else 'rejeté'} ({minutes()})")
        state["step"] = "gauge" if promoted else "next"
    elif step == "gauge":
        out = gen_dir / "gauge.json"
        node("ai:arena", "--challenger", state["champion"], "--champion", "legacy",
             "--games", args.gauge_games, "--seed", 999, "--time-ms", 200,
             "--workers", args.workers, "--json", out)
        gauge = read_json(out, ("score",))  # verdict de la jauge
        record["gauge"] = gauge["score"]
        say(f"gen {n} · jauge contre evaluate.ts à temps égal : {gauge['score'] * 100:.1f} % ({minutes()})")
        state["step"] = "next"
    if state["step"] == "next":
        state["generation"] = n + 1
        state["step"] = "selfplay"


def main() -> None:
    parser = argparse.ArgumentParser(description="Boucle d'entraînement de l'IA (reprend automatiquement)")
    parser.add_argument("--hours", type=float, required=True, help="durée avant de s'arrêter entre deux étapes")
    parser.add_argument("--run", default="main", help="nom de l'entraînement (dossier runs/<run>)")
    parser.add_argument("--games", type=int, default=DEFAULT_GAMES, help="parties d'auto-jeu par génération")
    parser.add_argument("--arena-games", type=int, default=400)
    parser.add_argument("--gauge-games", type=int, default=100)
    parser.add_argument("--budget", type=int, default=2000, help="nœuds du planificateur par décision")
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    args = parser.parse_args()

    run_dir = ROOT / "runs" / args.run
    data_root = ROOT / "data" / args.run
    run_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(run_dir, args.run)
    deadline = time.time() + args.hours * 3600
    say(f"« {args.run} » : génération {state['generation']}, étape {state['step']}, {args.workers} processus")
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))  # SIGTERM = Ctrl+C
    try:  # Ctrl+C : l'état sauvé est celui de la dernière étape finie
        while time.time() < deadline:  # tant qu'il reste du temps
            run_step(state, args, run_dir, data_root)  # une étape
            save_json(run_dir / "state.json", state)  # état sauvé (atomique) après chaque étape
            write_report(run_dir, state)  # rapport à jour
    except KeyboardInterrupt:  # arrêt demandé par l'utilisateur
        say("Interrompu : l'étape en cours sera refaite au prochain lancement.")  # rien n'est perdu
    else:
        say(f"Temps écoulé. Rapport : {run_dir / 'report.md'}. Relancer la même commande pour continuer.")


if __name__ == "__main__":
    main()
