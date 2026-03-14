Feature: Flux complet d'un joueur
  En tant que nouveau joueur
  Je veux m'inscrire, me connecter et interagir avec le jeu
  Pour vérifier que l'ensemble de la chaîne fonctionne

  Scenario: Flow complet - inscription puis consultation
    When j'envoie une requête POST sur "/auth/register" avec le body:
      """
      {
        "username": "fullflow_user3",
        "email": "fullflow3@example.com",
        "password": "Password123!"
      }
      """
    Then le statut de réponse est 201
    And la réponse contient un champ "email"
    And la réponse contient un champ "id"
    Given je suis connecté en tant que "fullflow3@example.com" avec le mot de passe "Password123!"
    When j'envoie une requête GET authentifiée sur "/users/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "email"
    When j'envoie une requête GET authentifiée sur "/boosters"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"
    When j'envoie une requête GET authentifiée sur "/quests/me"
    Then le statut de réponse est 200
    When j'envoie une requête GET authentifiée sur "/transactions"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"
