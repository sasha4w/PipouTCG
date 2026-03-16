Feature: Système de bundles
  En tant que joueur
  Je veux acheter des bundles contenant cartes et boosters
  Pour enrichir ma collection plus rapidement

  Background:
    Given je suis connecté en tant que joueur test

  # ── Connecté ─────────────────────────────────────────────────

  Scenario: Lister les bundles
    When j'envoie une requête GET authentifiée sur "/bundles"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter le détail d'un bundle
    When j'envoie une requête GET authentifiée sur "/bundles/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "name"
    And la réponse contient un champ "price"

  Scenario: Consulter un bundle inexistant renvoie 404
    When j'envoie une requête GET authentifiée sur "/bundles/99999"
    Then le statut de réponse est 404

  Scenario: Lister les bundles sans authentification renvoie 401
    When j'envoie une requête GET sur "/bundles"
    Then le statut de réponse est 401

  # ── Joueur ───────────────────────────────────────────────────

  Scenario: Acheter un bundle inexistant renvoie 404
    When j'envoie une requête POST authentifiée sur "/bundles/99999/buy"
    Then le statut de réponse est 404

  Scenario: Acheter un bundle sans assez de gold renvoie 400
    When j'envoie une requête POST authentifiée sur "/bundles/1/buy"
    Then le statut de réponse est 400

  Scenario: Ouvrir un bundle non possédé renvoie 400
    When j'envoie une requête POST authentifiée sur "/bundles/1/open"
    Then le statut de réponse est 400

  Scenario: Acheter puis ouvrir un bundle
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle Achat Test",
        "price": 0
      }
      """
    And le statut de réponse est 201
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
    And le statut de réponse est 201
    Given je suis connecté en tant que joueur test
    When j'envoie une requête POST authentifiée sur "/bundles/{bundleId}/buy"
    Then le statut de réponse est 201
    When j'envoie une requête POST authentifiée sur "/bundles/{bundleId}/open"
    Then le statut de réponse est 201
    And la réponse contient un champ "cards"
    And la réponse contient un champ "boosters"

  # ── Admin CRUD ───────────────────────────────────────────────

  Scenario: Un admin peut créer un bundle
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
    And la réponse contient un champ "name"
    And je sauvegarde l'id sous "bundleId"

  Scenario: Un admin peut ajouter du contenu à un bundle
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle Contenu Test",
        "price": 50
      }
      """
    And le statut de réponse est 201
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
    And la réponse contient un champ "contents"

  Scenario: Ajouter moins de 2 items dans un bundle renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle Invalide",
        "price": 50
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "bundleId"
    When j'envoie une requête POST authentifiée sur "/bundles/{bundleId}/contents" avec le body:
      """
      {
        "items": [
          { "cardId": 1, "quantity": 1 }
        ]
      }
      """
    Then le statut de réponse est 400

  Scenario: Un admin peut modifier un bundle
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle à Modifier",
        "price": 50
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "bundleId"
    When j'envoie une requête PATCH authentifiée sur "/bundles/{bundleId}" avec le body:
      """
      {
        "name": "Bundle Modifié"
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "name"

  Scenario: Un admin peut supprimer un bundle
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle à Supprimer",
        "price": 50
      }
      """
    And le statut de réponse est 201
    And je sauvegarde l'id sous "bundleId"
    When j'envoie une requête DELETE authentifiée sur "/bundles/{bundleId}"
    Then le statut de réponse est 200

  Scenario: Créer un bundle avec un nom trop court renvoie 400
    Given je suis connecté en tant qu'admin
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "A",
        "price": 50
      }
      """
    Then le statut de réponse est 400

  # ── Accès ────────────────────────────────────────────────────

  Scenario: Un utilisateur ne peut pas créer un bundle renvoie 403
    When j'envoie une requête POST authentifiée sur "/bundles" avec le body:
      """
      {
        "name": "Bundle non autorisé",
        "price": 50
      }
      """
    Then le statut de réponse est 403

  Scenario: Un utilisateur ne peut pas supprimer un bundle renvoie 403
    When j'envoie une requête DELETE authentifiée sur "/bundles/1"
    Then le statut de réponse est 403

  Scenario: Acheter un bundle sans être connecté renvoie 401
    When j'envoie une requête POST sur "/bundles/1/buy"
    Then le statut de réponse est 401