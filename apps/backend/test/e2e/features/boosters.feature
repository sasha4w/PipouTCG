Feature: Système de boosters
  En tant que joueur
  Je veux acheter et ouvrir des boosters
  Pour obtenir des cartes

  Background:
    Given je suis connecté en tant que joueur test

  # ── Connecté ─────────────────────────────────────────────────

  Scenario: Lister les boosters disponibles
    When j'envoie une requête GET authentifiée sur "/boosters"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'un booster
    When j'envoie une requête GET authentifiée sur "/boosters/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And la réponse contient un champ "price"

  Scenario: Consulter un booster inexistant renvoie 404
    When j'envoie une requête GET authentifiée sur "/boosters/99999"
    Then le statut de réponse est 404

  Scenario: Lister les boosters sans authentification renvoie 401
    When j'envoie une requête GET sur "/boosters"
    Then le statut de réponse est 401

  # ── Joueur ───────────────────────────────────────────────────

  Scenario: Acheter un booster inexistant renvoie 404
    When j'envoie une requête POST authentifiée sur "/boosters/99999/buy"
    Then le statut de réponse est 404

  Scenario: Acheter un booster sans assez de gold renvoie 400
    When j'envoie une requête POST authentifiée sur "/boosters/1/buy"
    Then le statut de réponse est 400

  Scenario: Ouvrir un booster non possédé renvoie 400
    When j'envoie une requête POST authentifiée sur "/boosters/1/open"
    Then le statut de réponse est 400

  Scenario: Acheter puis ouvrir un booster
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster Achat Test",
        "price": 0,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "boosterId"
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/boosters/{boosterId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/boosters/{boosterId}/open"
    Then le statut de réponse est 201
    And la réponse contient un champ "cards"
    And la réponse contient un champ "booster"

  Scenario: Acheter un booster sans être connecté renvoie 401
    When j'envoie une requête POST sur "/boosters/1/buy"
    Then le statut de réponse est 401

  # ── Admin CRUD ───────────────────────────────────────────────

  Scenario: Un admin peut créer un booster
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster Test",
        "price": 100,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And je sauvegarde l'id sous "boosterId"

  Scenario: Un admin peut modifier un booster
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster à Modifier",
        "price": 100,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "boosterId"
    When j'envoie une requête PATCH authentifiée sur "/boosters/{boosterId}" avec le body:
      """
      {
        "name": "Booster Modifié",
        "price": 200
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "name"

  Scenario: Un admin peut supprimer un booster
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster à Supprimer",
        "price": 100,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "boosterId"
    When j'envoie une requête DELETE authentifiée sur "/boosters/{boosterId}"
    Then le statut de réponse est 200

  Scenario: Créer un booster avec un cardNumber invalide renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster Invalide",
        "price": 100,
        "cardNumber": 999,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 400

  Scenario: Créer un booster avec un nom trop court renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "A",
        "price": 100,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 400

  # ── Accès ────────────────────────────────────────────────────

  Scenario: Un utilisateur ne peut pas créer un booster renvoie 403
    When j'envoie une requête POST authentifiée sur "/boosters" avec le body:
      """
      {
        "name": "Booster non autorisé",
        "price": 100,
        "cardNumber": 5,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 403

  Scenario: Un utilisateur ne peut pas supprimer un booster renvoie 403
    When j'envoie une requête DELETE authentifiée sur "/boosters/1"
    Then le statut de réponse est 403