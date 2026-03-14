Feature: Gestion des cartes
  En tant qu'utilisateur de CardCollect
  Je veux pouvoir consulter les cartes disponibles
  Et en tant qu'admin, gérer le catalogue

  Scenario: Lister toutes les cartes (public)
    When j'envoie une requête GET authentifiée sur "/cards"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'une carte
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/cards/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"

  Scenario: Consulter une carte inexistante retourne 404
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/cards/999999"
    Then le statut de réponse est 404

  Scenario: Un admin peut créer et modifier une carte
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte Test Dragon",
        "rarity": "rare",
        "type": "monster",
        "atk": 100,
        "hp": 50,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And je sauvegarde l'id sous "cardId"
    When j'envoie une requête PUT authentifiée sur "/cards/{cardId}" avec le body:
      """
      {
        "name": "Carte Test Dragon Modifiée"
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "name"

  Scenario: Un utilisateur ne peut pas créer une carte
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte non autorisée",
        "rarity": "common",
        "type": "monster",
        "atk": 10,
        "hp": 10,
        "cardSetId": 1
      }
      """
    Then le statut de réponse est 403
