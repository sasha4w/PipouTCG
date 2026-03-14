Feature: Système de bundles
  En tant que joueur
  Je veux acheter des bundles contenant cartes et boosters
  Pour enrichir ma collection plus rapidement

  Scenario: Lister les bundles disponibles
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/bundles"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'un bundle
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/bundles/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And la réponse contient un champ "price"

  Scenario: Consulter un bundle inexistant retourne 404
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/bundles/999999"
    Then le statut de réponse est 404

  Scenario: Un admin peut créer, ajouter du contenu, modifier et un joueur peut acheter et ouvrir un bundle
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle Test Starter",
        "price": 100
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And je sauvegarde l'id sous "bundleId"
    When j'envoie une requête POST authentifiée sur "/bundles/{bundleId}/contents" avec le body:
      """
      {
        "items": [
          { "cardId": 1, "quantity": 1 },
          { "cardId": 3, "quantity": 1 }
        ]
      }
      """
    Then le statut de réponse est 201
    When j'envoie une requête PATCH authentifiée sur "/bundles/{bundleId}" avec le body:
      """
      {
        "name": "Bundle Test Starter Modifié"
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "name"
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/bundles/{bundleId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/bundles/{bundleId}/open"
    Then le statut de réponse est 201
    And la réponse contient un champ "cards"
    And la réponse contient un champ "boosters"

  Scenario: Un bundle inexistant retourne 404 à l'achat
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/bundles/999999/buy"
    Then le statut de réponse est 404

  Scenario: Un utilisateur ne peut pas créer un bundle
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle non autorisé"
      }
      """
    Then le statut de réponse est 403