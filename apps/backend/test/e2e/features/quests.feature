Feature: Système de quêtes et achievements
  En tant que joueur
  Je veux consulter et réclamer mes récompenses de quêtes
  Pour progresser dans le jeu

  Background:
    Given je suis connecté en tant que joueur test

  Scenario: Consulter mes quêtes en cours
    When j'envoie une requête GET authentifiée sur "/quests/me"
    Then le statut de réponse est 200

  Scenario: Consulter les quêtes disponibles (admin only)
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/quests"
    Then le statut de réponse est 200
    And la réponse est un tableau

  Scenario: Un admin peut créer, modifier, toggler et supprimer une quête
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/quests" avec le body:
      """
      {
        "title": "Quête Test",
        "description": "Ouvrir 1 booster",
        "resetType": "DAILY",
        "rewardType": "GOLD",
        "rewardAmount": 50,
        "conditionGroup": {
          "operator": "AND",
          "conditions": [
            {
              "type": "OPEN_BOOSTER",
              "amount": 1
            }
          ]
        }
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And je sauvegarde l'id sous "questId"
    When j'envoie une requête PATCH authentifiée sur "/quests/{questId}" avec le body:
      """
      {
        "title": "Quête Modifiée",
        "rewardAmount": 100
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    When j'envoie une requête PATCH authentifiée sur "/quests/{questId}/toggle"
    Then le statut de réponse est 200
