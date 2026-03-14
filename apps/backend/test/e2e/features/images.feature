Feature: Gestion des images
  En tant qu'admin
  Je veux gérer des images découplées du contenu
  Pour les réutiliser sur plusieurs cartes

  Scenario: Lister toutes les images disponibles
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/images"
    Then le statut de réponse est 200
    And la réponse est un tableau

  Scenario: Consulter une image inexistante retourne 404
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/images/999999"
    Then le statut de réponse est 404

  Scenario: Un utilisateur ne peut pas lister les images
    Given je suis connecté en tant que joueur test
    When j'envoie une requête GET authentifiée sur "/images"
    Then le statut de réponse est 403
