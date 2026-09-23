Feature: Marketplace et transactions
  En tant que joueur
  Je veux pouvoir consulter le marketplace
  Pour échanger avec d'autres joueurs

  Background:
    Given je suis connecté en tant que joueur test

  # ── Consultation ─────────────────────────────────────────────

  Scenario: Lister les offres des autres joueurs
    When j'envoie une requête GET authentifiée sur "/transactions/offers"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Un admin peut lister toutes les annonces
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/transactions"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Un joueur ne peut pas lister toutes les annonces renvoie 403
    When j'envoie une requête GET authentifiée sur "/transactions"
    Then le statut de réponse est 403

  Scenario: Consulter l'historique de mes transactions
    When j'envoie une requête GET authentifiée sur "/transactions/history"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  # ── Créer une annonce ─────────────────────────────────────────

  Scenario: Créer une annonce pour vendre un booster
    When j'envoie une requête POST authentifiée sur "/boosters/{cheapBoosterId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/transactions/listing" avec le body:
      """
      {
        "productType": "BOOSTER",
        "productId": {cheapBoosterId},
        "quantity": 1,
        "unitPrice": 50
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And la réponse contient un champ "status"

  Scenario: Créer une annonce pour un booster non possédé renvoie 400
    When j'envoie une requête POST authentifiée sur "/transactions/listing" avec le body:
      """
      {
        "productType": "BOOSTER",
        "productId": {boosterId},
        "quantity": 1,
        "unitPrice": 50
      }
      """
    Then le statut de réponse est 400

  Scenario: Créer une annonce sans authentification renvoie 401
    When j'envoie une requête POST non authentifiée sur "/transactions/listing" avec le body:
      """
      {
        "productType": "BOOSTER",
        "productId": {cheapBoosterId},
        "quantity": 1,
        "unitPrice": 50
      }
      """
    Then le statut de réponse est 401

  Scenario: Créer une annonce avec un body invalide renvoie 400
    When j'envoie une requête POST authentifiée sur "/transactions/listing" avec le body:
      """
      {
        "productType": "BOOSTER"
      }
      """
    Then le statut de réponse est 400

  # ── Acheter une annonce ───────────────────────────────────────

  Scenario: L'admin achète l'annonce du joueur test
    When j'envoie une requête POST authentifiée sur "/boosters/{cheapBoosterId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/transactions/listing" avec le body:
      """
      {
        "productType": "BOOSTER",
        "productId": {cheapBoosterId},
        "quantity": 1,
        "unitPrice": 50
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "listingId"
    And je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/transactions/{listingId}/buy"
    Then le statut de réponse est 201
    And la réponse contient un champ "status"

  Scenario: Acheter sa propre annonce renvoie 400
    When j'envoie une requête POST authentifiée sur "/boosters/{cheapBoosterId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/transactions/listing" avec le body:
      """
      {
        "productType": "BOOSTER",
        "productId": {cheapBoosterId},
        "quantity": 1,
        "unitPrice": 50
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "selfListingId"
    When j'envoie une requête POST authentifiée sur "/transactions/{selfListingId}/buy"
    Then le statut de réponse est 400

  Scenario: Acheter une annonce inexistante renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/transactions/99999/buy"
    Then le statut de réponse est 400
