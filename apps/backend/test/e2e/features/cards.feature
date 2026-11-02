Feature: Gestion des cartes
  En tant qu'utilisateur de CardCollect
  Je veux pouvoir consulter les cartes disponibles
  Et en tant qu'admin, gérer le catalogue

  Background:
    Given je suis connecté en tant que joueur test

  # ── Public connecté ──────────────────────────────────────────

  Scenario: Lister toutes les cartes
    When j'envoie une requête GET authentifiée sur "/cards"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'une carte
    When j'envoie une requête GET authentifiée sur "/cards/{cardId}"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And la réponse contient un champ "rarity"
    And la réponse contient un champ "type"

  Scenario: Consulter une carte inexistante renvoie 404
    When j'envoie une requête GET authentifiée sur "/cards/99999"
    Then le statut de réponse est 404

  Scenario: Lister les cartes d'un set
    When j'envoie une requête GET authentifiée sur "/cards/set/{setId}"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Lister les cartes sans authentification renvoie 401
    When j'envoie une requête GET sur "/cards" sans authentification
    Then le statut de réponse est 401

  # ── Admin CRUD ───────────────────────────────────────────────

  Scenario: Un admin peut créer une carte
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte Test Dragon",
        "rarity": "rare",
        "type": "monster",
        "atk": 100,
        "hp": 50,
        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And je sauvegarde l'id sous "cardId"

  Scenario: Un admin peut modifier une carte
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte à Modifier",
        "rarity": "common",
        "type": "monster",
        "atk": 10,
        "hp": 10,
        "cardSetId": {setId}
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "cardId"
    When j'envoie une requête PUT authentifiée sur "/cards/{cardId}" avec le body:
      """
      {
        "name": "Carte Modifiée",
        "rarity": "common",
        "type": "monster",
        "atk": 10,
        "hp": 10,
        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "name"

  Scenario: Un admin peut supprimer une carte
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte à Supprimer",
        "rarity": "common",
        "type": "support",
        "atk": 10,
        "hp": 10,
        "cardSetId": {setId}
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "cardId"
    When j'envoie une requête DELETE authentifiée sur "/cards/{cardId}"
    Then le statut de réponse est 200

  Scenario: Créer une carte avec un body invalide renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte Invalide"
      }
      """
    Then le statut de réponse est 400

  # ── Accès ────────────────────────────────────────────────────

  Scenario: Un utilisateur ne peut pas créer une carte renvoie 403
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Carte non autorisée",
        "rarity": "common",
        "type": "monster",
        "atk": 10,
        "hp": 10,
        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 403

  Scenario: Un utilisateur ne peut pas supprimer une carte renvoie 403
    When j'envoie une requête DELETE authentifiée sur "/cards/{cardId}"
    Then le statut de réponse est 403

  # ── Création par type de carte ───────────────────────────────

  Scenario: Un admin peut créer un monstre
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Monstre",
        "rarity": "common",
        "type": "monster",
        "atk": 10,
        "hp": 10,
        "archetype": "pipou",

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 201

  Scenario: Un admin peut créer un support éphémère
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Ephemere",
        "rarity": "common",
        "type": "support",
        "atk": 0,
        "hp": 0,
        "supportType": "EPHEMERAL",

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 201

  Scenario: Un admin peut créer un équipement
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Equipement",
        "rarity": "common",
        "type": "support",
        "atk": 0,
        "hp": 0,
        "supportType": "EQUIPMENT",
        "equipmentSlot": "OFFENSIVE",

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 201

  Scenario: Un admin peut créer un persistant Terrain
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Terrain",
        "rarity": "common",
        "type": "support",
        "atk": 0,
        "hp": 0,
        "supportType": "PERSISTENT",
        "isTerrain": true,

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 201

  Scenario: Un admin peut créer une charge
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Charge",
        "rarity": "common",
        "type": "support",
        "atk": 0,
        "hp": 0,
        "supportType": "CHARGE",
        "chargeMax": 3,
        "chargeMode": "ONE_SHOT",

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 201

  Scenario: Un équipement sans emplacement renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Equipement KO",
        "rarity": "common",
        "type": "support",
        "atk": 0,
        "hp": 0,
        "supportType": "EQUIPMENT",

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 400

  Scenario: Un emplacement sur un éphémère renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/cards" avec le body:
      """
      {
        "name": "Test Slot KO",
        "rarity": "common",
        "type": "support",
        "atk": 0,
        "hp": 0,
        "supportType": "EPHEMERAL",
        "equipmentSlot": "OFFENSIVE",

        "cardSetId": {setId}
      }
      """
    Then le statut de réponse est 400
