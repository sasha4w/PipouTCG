# Rend les modules de tools/ai-train importables depuis les tests.
import sys  # liste des chemins où Python cherche les modules
from pathlib import Path  # manipulation de chemins indépendante du système

# Ajoute le dossier parent (tools/ai-train) en tête de la recherche de modules.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# Ajoute aussi le dossier des tests (pour importer fake_data).
sys.path.insert(0, str(Path(__file__).resolve().parent))
