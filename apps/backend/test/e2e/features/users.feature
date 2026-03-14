Feature: Gestion des utilisateurs
  En tant qu'utilisateur connecté
  Je veux pouvoir consulter et gérer mon profil

  Background:
    Given je suis connecté en tant que joueur test

  Scenario: Consulter mon profil
    When j'envoie une requête GET authentifiée sur "/users/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "email"
    And la réponse contient un champ "username"

  Scenario: Consulter mon inventaire
    When j'envoie une requête GET authentifiée sur "/users/me/inventory"
    Then le statut de réponse est 200
    And la réponse contient un champ "cards"

  Scenario: Consulter mes statistiques
    When j'envoie une requête GET authentifiée sur "/users/me/stats"
    Then le statut de réponse est 200

  Scenario: Un admin peut lister tous les utilisateurs
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/users"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Un admin peut consulter le profil d'un joueur
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/users/1"
    Then le statut de réponse est 200

  Scenario: Un utilisateur peut basculer la confidentialité de son profil
    When j'envoie une requête PATCH authentifiée sur "/users/1/privacy"
    Then le statut de réponse est 200