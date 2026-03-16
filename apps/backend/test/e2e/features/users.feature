Feature: Gestion des utilisateurs
  En tant qu'utilisateur connecté
  Je veux pouvoir consulter et gérer mon profil

  Background:
    Given je suis connecté en tant que joueur test

  # ── Mon profil ────────────────────────────────────────────────

  Scenario: Consulter mon profil
    When j'envoie une requête GET authentifiée sur "/users/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "id"
    And la réponse contient un champ "username"
    And la réponse contient un champ "email"

  Scenario: Consulter mes statistiques
    When j'envoie une requête GET authentifiée sur "/users/me/stats"
    Then le statut de réponse est 200
    And la réponse contient un champ "level"
    And la réponse contient un champ "gold"
    And la réponse contient un champ "stats"

  Scenario: Consulter mon inventaire
    When j'envoie une requête GET authentifiée sur "/users/me/inventory"
    Then le statut de réponse est 200
    And la réponse contient un champ "cards"
    And la réponse contient un champ "boosters"
    And la réponse contient un champ "bundles"

  # ── Profil public d'un autre joueur ──────────────────────────

  Scenario: Consulter le profil public d'un joueur
    When j'envoie une requête GET authentifiée sur "/users/1/profile"
    Then le statut de réponse est 200
    And la réponse contient un champ "username"
    And la réponse contient un champ "level"

  Scenario: Consulter le portfolio de cartes d'un joueur
    When j'envoie une requête GET authentifiée sur "/users/1/portfolio"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter les boosters d'un joueur
    When j'envoie une requête GET authentifiée sur "/users/1/boosters"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter les bundles d'un joueur
    When j'envoie une requête GET authentifiée sur "/users/1/bundles"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  # ── Privacy ──────────────────────────────────────────────────

  Scenario: Basculer la confidentialité de mon profil
    When j'envoie une requête PATCH authentifiée sur "/users/1/privacy"
    Then le statut de réponse est 200
    And la réponse contient un champ "isPrivate"
    When j'envoie une requête PATCH authentifiée sur "/users/1/privacy"
    Then le statut de réponse est 200

  Scenario: Basculer la confidentialité du profil d'un autre renvoie 403
    Given je suis connecté en tant que "other@test.com" avec le mot de passe "Password123!"
    When j'envoie une requête PATCH authentifiée sur "/users/1/privacy"
    Then le statut de réponse est 403

  Scenario: Consulter l'inventaire d'un profil privé sans permission renvoie 403
    Given j'envoie une requête PATCH authentifiée sur "/users/1/privacy"
    And le statut de réponse est 200
    Given je suis connecté en tant que "other@test.com" avec le mot de passe "Password123!"
    When j'envoie une requête GET authentifiée sur "/users/1/inventory"
    Then le statut de réponse est 403
    Given je suis connecté en tant que joueur test
    And j'envoie une requête PATCH authentifiée sur "/users/1/privacy"

  # ── Admin ────────────────────────────────────────────────────

  Scenario: Un admin peut lister tous les utilisateurs
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/users"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Un non-admin ne peut pas lister les utilisateurs renvoie 403
    When j'envoie une requête GET authentifiée sur "/users"
    Then le statut de réponse est 403

  Scenario: Un admin peut consulter n'importe quel utilisateur
    Given je suis connecté en tant qu'admin
    When j'envoie une requête GET authentifiée sur "/users/1"
    Then le statut de réponse est 200
    And la réponse contient un champ "username"