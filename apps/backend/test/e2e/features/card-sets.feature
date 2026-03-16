Feature: Gestion des sets de cartes
  En tant que joueur
  Je veux consulter les sets de cartes à compléter
  Pour suivre ma progression de collection

  Background:
    Given je suis connecté en tant que joueur test

  # ── Connecté ─────────────────────────────────────────────────

  Scenario: Lister tous les sets
    When j'envoie une requête GET authentifiée sur "/card-sets"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'un set
    When j'envoie une requête GET authentifiée sur "/card-sets/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"

  Scenario: Consulter un set inexistant renvoie 404
    When j'envoie une requête GET authentifiée sur "/card-sets/99999"
    Then le statut de réponse est 404

  Scenario: Lister les sets sans authentification renvoie 401
    When j'envoie une requête GET sur "/card-sets"
    Then le statut de réponse est 401

  # ── Admin CRUD ───────────────────────────────────────────────

  Scenario: Un admin peut créer un set
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "Set Test Légendaire"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And je sauvegarde l'id sous "cardSetId"

  Scenario: Un admin peut modifier un set
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "Set à Modifier"
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "cardSetId"
    When j'envoie une requête PUT authentifiée sur "/card-sets/{cardSetId}" avec le body:
      """
      {
        "name": "Set Modifié"
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "name"

  Scenario: Un admin peut supprimer un set
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "Set à Supprimer"
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "cardSetId"
    When j'envoie une requête DELETE authentifiée sur "/card-sets/{cardSetId}"
    Then le statut de réponse est 200

  Scenario: Créer un set avec un nom trop court renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "A"
      }
      """
    Then le statut de réponse est 400

  # ── Accès ────────────────────────────────────────────────────

  Scenario: Un utilisateur ne peut pas créer un set renvoie 403
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "Set non autorisé"
      }
      """
    Then le statut de réponse est 403

  Scenario: Un utilisateur ne peut pas supprimer un set renvoie 403
    When j'envoie une requête DELETE authentifiée sur "/card-sets/1"
    Then le statut de réponse est 403