Feature: Flux complet d'un joueur
  En tant que nouveau joueur
  Je veux m'inscrire, me connecter et interagir avec le jeu
  Pour vérifier que l'ensemble de la chaîne fonctionne

  Scenario: Flow complet - inscription, achat booster, ouverture, marketplace
    # ── Inscription ──────────────────────────────────────────
    When j'envoie une requête POST sur "/auth/register" avec le body:
      """
      {
        "username": "fullflow_user3",
        "email": "fullflow3@example.com",
        "password": "Password123!"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "email"
    And la réponse contient un champ "id"

    # ── Connexion ────────────────────────────────────────────
    Given je suis connecté en tant que "fullflow3@example.com" avec le mot de passe "Password123!"

    # ── Consultation profil ──────────────────────────────────
    When j'envoie une requête GET authentifiée sur "/users/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "email"

    # ── Consultation catalogue ───────────────────────────────
    When j'envoie une requête GET authentifiée sur "/boosters"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

    When j'envoie une requête GET authentifiée sur "/card-sets"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

    When j'envoie une requête GET authentifiée sur "/cards"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

    # ── Quêtes assignées au login ────────────────────────────
    When j'envoie une requête GET authentifiée sur "/quests/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "DAILY"
    And la réponse contient un champ "ACHIEVEMENT"

    # ── Admin crée un booster gratuit pour le test ───────────
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster Full Flow",
        "price": 0,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 201
    And je sauvegarde l'id sous "boosterId"

    # ── Joueur achète et ouvre le booster ────────────────────
    Given je suis connecté en tant que "fullflow3@example.com" avec le mot de passe "Password123!"
    When j'envoie une requête POST authentifiée sur "/boosters/{boosterId}/buy"
    Then le statut de réponse est 201

    When j'envoie une requête POST authentifiée sur "/boosters/{boosterId}/open"
    Then le statut de réponse est 201
    And la réponse contient un champ "cards"

    # ── Inventaire mis à jour ────────────────────────────────
    When j'envoie une requête GET authentifiée sur "/users/me/inventory"
    Then le statut de réponse est 200
    And la réponse contient un champ "cards"
    And la réponse contient un champ "boosters"

    # ── Marketplace ──────────────────────────────────────────
    When j'envoie une requête GET authentifiée sur "/transactions"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

    When j'envoie une requête GET authentifiée sur "/transactions/history"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"