Feature: Marketplace et transactions
  En tant que joueur
  Je veux pouvoir consulter le marketplace
  Pour échanger avec d'autres joueurs

  Background:
    Given je suis connecté en tant que joueur test

  Scenario: Lister les annonces du marketplace
    When j'envoie une requête GET authentifiée sur "/transactions"
    Then le statut de réponse est 200
    And la réponse contient un champ "data"

  Scenario: Consulter l'historique de mes transactions
    When j'envoie une requête GET authentifiée sur "/transactions/history"
    Then le statut de réponse est 200
