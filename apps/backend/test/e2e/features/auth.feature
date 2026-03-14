Feature: Authentification
  En tant qu'utilisateur de CardCollect
  Je veux pouvoir créer un compte et me connecter
  Pour accéder aux fonctionnalités du jeu

  Scenario: Inscription d'un nouvel utilisateur
    When j'envoie une requête POST sur "/auth/register" avec le body:
      """
      {
        "username": "testuser_auth",
        "email": "testauth@example.com",
        "password": "Password123!"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "email"
    And la réponse contient un champ "username"
    And la réponse contient un champ "id"

  Scenario: Connexion avec des identifiants valides
    Given un utilisateur "logintest@example.com" avec le mot de passe "Password123!" existe
    When j'envoie une requête POST sur "/auth/login" avec le body:
      """
      {
        "email": "logintest@example.com",
        "password": "Password123!"
      }
      """
    Then le statut de réponse est 200
    And la réponse contient un champ "access_token"

  Scenario: Connexion avec un mauvais mot de passe
    Given un utilisateur "logintest2@example.com" avec le mot de passe "GoodPassword!" existe
    When j'envoie une requête POST sur "/auth/login" avec le body:
      """
      {
        "email": "logintest2@example.com",
        "password": "WrongPassword!"
      }
      """
    Then le statut de réponse est 401

  Scenario: Inscription avec un email déjà utilisé
    Given un utilisateur "duplicate@example.com" avec le mot de passe "Password123!" existe
    When j'envoie une requête POST sur "/auth/register" avec le body:
      """
      {
        "username": "duplicate2",
        "email": "duplicate@example.com",
        "password": "Password123!"
      }
      """
    Then le statut de réponse est 409

  Scenario: Accès à une route protégée sans token
    When j'envoie une requête GET sur "/users/me" sans authentification
    Then le statut de réponse est 401
