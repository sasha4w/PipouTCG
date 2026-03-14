Feature: Système de boosters
  En tant que joueur
  Je veux acheter et ouvrir des boosters
  Pour obtenir des cartes

  Background:
    Given je suis connecté en tant que joueur test

  Scenario: Lister les boosters disponibles
    When j'envoie une requête GET authentifiée sur "/boosters"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Un admin peut créer un booster, un joueur peut l'acheter et l'ouvrir
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
    And je sauvegarde l'id sous "boosterId"
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/boosters/{boosterId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/boosters/{boosterId}/open"
    Then le statut de réponse est 201
    And la réponse contient un champ "cards"
    And la réponse contient un champ "booster"
    
  Scenario: Un utilisateur ne peut pas créer un booster
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