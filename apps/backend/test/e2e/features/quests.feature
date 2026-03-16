Feature: Système de quêtes et achievements
  En tant que joueur
  Je veux consulter et réclamer mes récompenses de quêtes
  Pour progresser dans le jeu

  Background:
    Given je suis connecté en tant que joueur test

  # ── Joueur ───────────────────────────────────────────────────

  Scenario: Consulter mes quêtes en cours
    When j'envoie une requête GET authentifiée sur "/quests/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "DAILY"
    And la réponse contient un champ "WEEKLY"
    And la réponse contient un champ "ACHIEVEMENT"

  Scenario: Un non-admin ne peut pas lister toutes les quêtes renvoie 403
    When j'envoie une requête GET authentifiée sur "/quests"
    Then le statut de réponse est 403

  Scenario: Réclamer la récompense d'une quête inexistante renvoie 404
    When j'envoie une requête POST authentifiée sur "/quests/99999/claim"
    Then le statut de réponse est 404

  # ── Admin CRUD ───────────────────────────────────────────────

  Scenario: Un admin peut créer une quête
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
    And la réponse contient un champ "title"
    And la réponse contient un champ "isActive"
    And je sauvegarde l'id sous "questId"

  Scenario: Un admin peut consulter une quête par son id
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/quests" avec le body:
      """
      {
        "title": "Quête Consultation",
        "resetType": "NONE",
        "rewardType": "GOLD",
        "rewardAmount": 10,
        "conditionGroup": {
          "operator": "AND",
          "conditions": [{ "type": "OPEN_BOOSTER", "amount": 1 }]
        }
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "questId"
    When j'envoie une requête GET authentifiée sur "/quests/{questId}"
    Then le statut de réponse est 200
    And la réponse contient un champ "title"

  Scenario: Un admin peut lister toutes les quêtes
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/quests"
    Then le statut de réponse est 200
    And la réponse est un tableau

  Scenario: Un admin peut modifier une quête
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/quests" avec le body:
      """
      {
        "title": "Quête à Modifier",
        "resetType": "NONE",
        "rewardType": "GOLD",
        "rewardAmount": 10,
        "conditionGroup": {
          "operator": "AND",
          "conditions": [{ "type": "OPEN_BOOSTER", "amount": 1 }]
        }
      }
      """
    And le statut de réponse est 201
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

  Scenario: Un admin peut toggler l'activation d'une quête
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/quests" avec le body:
      """
      {
        "title": "Quête Toggle",
        "resetType": "NONE",
        "rewardType": "GOLD",
        "rewardAmount": 10,
        "conditionGroup": {
          "operator": "AND",
          "conditions": [{ "type": "OPEN_BOOSTER", "amount": 1 }]
        }
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "questId"
    When j'envoie une requête PATCH authentifiée sur "/quests/{questId}/toggle"
    Then le statut de réponse est 200
    And la réponse contient un champ "isActive"

  Scenario: Un admin peut supprimer une quête
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/quests" avec le body:
      """
      {
        "title": "Quête à Supprimer",
        "resetType": "NONE",
        "rewardType": "GOLD",
        "rewardAmount": 10,
        "conditionGroup": {
          "operator": "AND",
          "conditions": [{ "type": "OPEN_BOOSTER", "amount": 1 }]
        }
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "questId"
    When j'envoie une requête DELETE authentifiée sur "/quests/{questId}"
    Then le statut de réponse est 200

  Scenario: Consulter une quête inexistante renvoie 404
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/quests/99999"
    Then le statut de réponse est 404

  Scenario: Créer une quête avec un body invalide renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/quests" avec le body:
      """
      {
        "title": "Quête Invalide"
      }
      """
    Then le statut de réponse est 400