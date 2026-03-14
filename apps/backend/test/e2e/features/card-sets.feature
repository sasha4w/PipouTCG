Feature: Gestion des sets de cartes
  En tant que joueur
  Je veux consulter les sets de cartes à compléter
  Pour suivre ma progression de collection

  Scenario: Lister tous les sets disponibles
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/card-sets"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'un set
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/card-sets/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"

  Scenario: Consulter un set inexistant retourne 404
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/card-sets/999999"
    Then le statut de réponse est 404

  Scenario: Un admin peut créer et modifier un set de cartes
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "Set Test Légendaire"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And je sauvegarde l'id sous "cardSetId"
    When j'envoie une requête PUT authentifiée sur "/card-sets/{cardSetId}" avec le body:
      """
      {
        "name": "Set Test Légendaire Modifié"
      }
      """
    Then le statut de réponse est 200

  Scenario: Un utilisateur ne peut pas créer un set
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/card-sets" avec le body:
      """
      {
        "name": "Set non autorisé"
      }
      """
    Then le statut de réponse est 403