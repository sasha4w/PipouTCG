Feature: Succès à paliers
  En tant que joueur
  Je veux suivre et réclamer mes succès
  Pour débloquer des récompenses et des titres

  Background:
    Given je suis connecté en tant que joueur test

  Scenario: Consulter mes succès
    When j'envoie une requête GET authentifiée sur "/achievements"
    Then le statut de réponse est 200
    And la réponse contient un champ "families"
    And la réponse contient un champ "unlocked"
    And la réponse contient un champ "total"
    And la réponse contient un champ "equippedTitle"

  Scenario: Réclamer une famille inconnue renvoie 400
    When j'envoie une requête POST authentifiée sur "/achievements/NOPE/claim"
    Then le statut de réponse est 400

  Scenario: Équiper un titre non débloqué renvoie 400
    When j'envoie une requête PUT authentifiée sur "/achievements/title" avec le body:
      """
      { "family": "LEVEL" }
      """
    Then le statut de réponse est 400

  Scenario: Retirer son titre
    When j'envoie une requête PUT authentifiée sur "/achievements/title" avec le body:
      """
      { "family": null }
      """
    Then le statut de réponse est 200
