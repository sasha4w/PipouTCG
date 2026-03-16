Feature: Gestion des images
  En tant qu'admin
  Je veux gérer des images découplées du contenu
  Pour les réutiliser sur plusieurs cartes

  # ── Accès ────────────────────────────────────────────────────

  Scenario: Un utilisateur ne peut pas lister les images renvoie 403
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/images"
    Then le statut de réponse est 403

  Scenario: Un accès sans authentification renvoie 401
    When j'envoie une requête GET sur "/images"
    Then le statut de réponse est 401

  # ── Admin ────────────────────────────────────────────────────

  Scenario: Un admin peut lister toutes les images
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/images"
    Then le statut de réponse est 200
    And la réponse est un tableau

  Scenario: Un admin peut supprimer une image inexistante renvoie 404
    Given je suis connecté en tant qu'admin
    When j'envoie une requête DELETE authentifiée sur "/images/99999"
    Then le statut de réponse est 404