Feature: Authentification
  En tant qu'utilisateur de CardCollect
  Je veux pouvoir créer un compte et me connecter
  Pour accéder aux fonctionnalités du jeu

  # ── Register ─────────────────────────────────────────────────

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

  Scenario: Inscription avec un email déjà utilisé renvoie 409
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

  Scenario: Inscription avec un body invalide renvoie 400
    When j'envoie une requête POST sur "/auth/register" avec le body:
      """
      {
        "username": "testuser"
      }
      """
    Then le statut de réponse est 400

  Scenario: Inscription avec un mot de passe trop court renvoie 400
    When j'envoie une requête POST sur "/auth/register" avec le body:
      """
      {
        "username": "testuser",
        "email": "short@example.com",
        "password": "123"
      }
      """
    Then le statut de réponse est 400

  # ── Login ─────────────────────────────────────────────────────

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

  Scenario: Connexion avec un mauvais mot de passe renvoie 401
    Given un utilisateur "logintest2@example.com" avec le mot de passe "GoodPassword!" existe
    When j'envoie une requête POST sur "/auth/login" avec le body:
      """
      {
        "email": "logintest2@example.com",
        "password": "WrongPassword!"
      }
      """
    Then le statut de réponse est 401

  Scenario: Connexion avec un email inexistant renvoie 401
    When j'envoie une requête POST sur "/auth/login" avec le body:
      """
      {
        "email": "nobody@example.com",
        "password": "Password123!"
      }
      """
    Then le statut de réponse est 401

  Scenario: Connexion avec un body invalide renvoie 400
    When j'envoie une requête POST sur "/auth/login" avec le body:
      """
      {
        "email": "pasunemail"
      }
      """
    Then le statut de réponse est 400

  # ── Forgot password ──────────────────────────────────────────

  Scenario: Demander une réinitialisation de mot de passe avec un email existant
    Given un utilisateur "resetme@example.com" avec le mot de passe "Password123!" existe
    When j'envoie une requête POST sur "/auth/forgot-password" avec le body:
      """
      {
        "email": "resetme@example.com"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "message"

  Scenario: Demander une réinitialisation avec un email inexistant renvoie quand même 201
    When j'envoie une requête POST sur "/auth/forgot-password" avec le body:
      """
      {
        "email": "nobody@example.com"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "message"

  Scenario: Forgot password avec un email invalide renvoie 400
    When j'envoie une requête POST sur "/auth/forgot-password" avec le body:
      """
      {
        "email": "pasunemail"
      }
      """
    Then le statut de réponse est 400

  # ── Reset password ───────────────────────────────────────────

  Scenario: Réinitialisation avec un token invalide renvoie 400
    When j'envoie une requête POST sur "/auth/reset-password" avec le body:
      """
      {
        "token": "token-invalide-00000000",
        "newPassword": "NewPassword123!"
      }
      """
    Then le statut de réponse est 400

  Scenario: Réinitialisation avec un mot de passe trop court renvoie 400
    When j'envoie une requête POST sur "/auth/reset-password" avec le body:
      """
      {
        "token": "token-invalide-00000000",
        "newPassword": "123"
      }
      """
    Then le statut de réponse est 400

  # ── Accès protégé ────────────────────────────────────────────

  Scenario: Accès à une route protégée sans token renvoie 401
    When j'envoie une requête GET sur "/users/me" sans authentification
    Then le statut de réponse est 401