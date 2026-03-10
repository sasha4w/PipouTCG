# CardCollect API

<p align="center">
  <img src="https://img.shields.io/badge/status-work%20in%20progress-orange?style=for-the-badge" alt="WIP" />
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest" />
</p>

> 🇫🇷 [Français](#français) | 🇬🇧 [English](#english)

---

<a name="français"></a>

# 🇫🇷 Français

## 🚧 Projet en cours de développement

CardCollect est un projet personnel, en cours de développement. La majeure partie du backend est fonctionnel et testé. Le frontend Next.js et les fonctionnalités de combat sont en cours de réalisation.

## Présentation

CardCollect est une API backend pour un jeu de cartes à collectionner (TCG) en ligne. Elle gère l'intégralité de la logique métier : collection de cartes, marketplace entre joueurs, système de quêtes et achievements, avec un système de combat et de deck-building prévu dans les prochaines versions.

## Stack technique

| Technologie       | Rôle              | Pourquoi ce choix                                                  |
| ----------------- | ----------------- | ------------------------------------------------------------------ |
| **NestJS**        | Framework backend | Architecture modulaire, injection de dépendances, TypeScript natif |
| **TypeORM**       | ORM               | Gestion des relations complexes, migrations, repositories typés    |
| **MySQL**         | Base de données   | Fiabilité des transactions, intégrité relationnelle                |
| **JWT**           | Authentification  | Stateless, sécurisé, standard de l'industrie                       |
| **Jest**          | Tests unitaires   | Couverture complète de la logique métier et des routes             |
| **Sharp + ImgBB** | Images            | Optimisation avant upload, réduction du poids des assets           |

## Architecture

L'application est découpée en **3 grandes directions** toutes en cours de développement :

### 1. 📦 Collection & Contenu `✅ Backend terminé`

Le cœur du jeu. Les joueurs dépensent leur gold pour acheter des boosters et des bundles, les ouvrent pour recevoir des cartes selon des taux de drop définis avec des garanties de rareté (ex : 1 carte RARE garantie à partir de 8 cartes). Des quêtes journalières, hebdomadaires, mensuelles et des achievements permanents récompensent la progression.

### 2. 💹 Marketplace & Trading `✅ Backend terminé`

Les joueurs peuvent mettre en vente leurs cartes, boosters et bundles. Les transactions sont **atomiques** (gérées via `DataSource.transaction()` TypeORM) : le gold et les items sont transférés simultanément, garantissant l'intégrité des échanges même en cas d'erreur.

### 3. ⚔️ Combat & Deck Building `🔜 À venir`

Un système de combat et de construction de decks sera développé une fois les deux premiers systèmes pleinement opérationnels côté frontend.

## Modules

```
auth/           → Inscription, connexion, JWT
users/          → Profil, inventaire, statistiques, vie privée
cards/          → Cartes avec upload et optimisation d'image
card-sets/      → Sets de cartes à compléter
boosters/       → Achat, ouverture, drop rates, garanties de rareté
bundles/        → Packs contenant cartes et boosters
quests/         → Quêtes (daily/weekly/monthly) + achievements one-shot
transactions/   → Marketplace, mise en vente, achat atomique, historique
images/         → Upload et optimisation d'images (Sharp + ImgBB)
```

## Fonctionnalités par profil

### 👑 Admin

- Dashboard pour gérer l'intégralité du contenu de l'application
- Création et gestion des cartes, sets, boosters, bundles, quêtes
- Activation/désactivation de contenu sans suppression
- Accès à la liste complète des utilisateurs

### 👤 Utilisateur

**Espace Collection**

- Acheter des boosters et bundles dans la boutique du jeu
- Ouvrir les boosters avec gestion des drop rates et garanties de rareté
- Consulter et filtrer son inventaire

**Espace Profil**

- Niveau calculé dynamiquement selon l'expérience accumulée
- Statistiques détaillées (boosters ouverts, cartes achetées/vendues, gold dépensé...)
- Suivi des quêtes et réclamation des récompenses
- Gestion de la confidentialité du profil

**Espace Marketplace**

- Mise en vente de cartes, boosters et bundles
- Achat des annonces des autres joueurs
- Historique paginé des transactions

## Tests

```
✅ auth        → service + controller
✅ users       → service + controller
✅ cards       → service + controller
✅ card-sets   → service + controller
✅ boosters    → service + controller
✅ bundles     → service + controller
✅ quests      → service + controller
✅ transactions → service + controller
```

```bash
npm run test            # Lancer tous les tests
npm run test:watch      # Mode watch
npm run test auth       # Tester un module spécifique
npm run test:cov        # Couverture de code
```

## Roadmap

- [x] Architecture NestJS modulaire
- [x] Authentification JWT
- [x] Gestion des cartes avec upload d'image
- [x] Système de boosters avec drop rates
- [x] Système de bundles
- [x] Quêtes et achievements
- [x] Marketplace avec transactions atomiques
- [x] Tests unitaires Jest : tous les modules
- [ ] Tests d'intégration Postman : en cours
- [ ] Frontend Next.js
- [ ] Système de combat
- [ ] Deck building
- [ ] Tests E2E
- [ ] Déploiement en production

## Installation

```bash
# Cloner le projet
git clone <repo-url>
cd cardcollect-api

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# → Remplir les valeurs dans .env

# Lancer en développement
npm run start:dev
```

## Variables d'environnement

```env
DB_HOST=        # Hôte de la base de données
DB_USER=        # Utilisateur MySQL
DB_PASSWORD=    # Mot de passe MySQL
DB_NAME=        # Nom de la base de données
JWT_SECRET=     # Clé secrète pour signer les tokens JWT
IMGBB_API_KEY=  # Clé API ImgBB pour l'upload d'images
```

---

<a name="english"></a>

# 🇬🇧 English

## 🚧 Work in Progress

CardCollect is an personal project, currently in development. The backend is mostly functional and tested. the Next.js frontend and battle features are being built.

## Overview

CardCollect is a backend API for an online Trading Card Game (TCG). It handles all business logic: card collection, player-to-player marketplace, quests and achievements, with a battle and deck-building system planned for future versions.

## Tech Stack

| Technology        | Role              | Why                                                           |
| ----------------- | ----------------- | ------------------------------------------------------------- |
| **NestJS**        | Backend framework | Modular architecture, dependency injection, native TypeScript |
| **TypeORM**       | ORM               | Complex relation handling, migrations, typed repositories     |
| **MySQL**         | Database          | Transaction reliability, relational integrity                 |
| **JWT**           | Authentication    | Stateless, secure, industry standard                          |
| **Jest**          | Unit testing      | Full coverage of business logic and routes                    |
| **Sharp + ImgBB** | Images            | Optimization before upload, asset size reduction              |

## Architecture

The application is built around **3 main directions**, all currently in development:

### 1. 📦 Collection & Content `✅ Backend complete`

The core of the game. Players spend gold to buy boosters and bundles, open them to receive cards based on defined drop rates with rarity guarantees (e.g. 1 guaranteed RARE card from 8 cards). Daily, weekly, monthly quests and permanent one-shot achievements reward progression.

### 2. 💹 Marketplace & Trading `✅ Backend complete`

Players can list their cards, boosters and bundles for sale. Transactions are **atomic** (handled via TypeORM `DataSource.transaction()`): gold and items are transferred simultaneously, guaranteeing trade integrity even if an error occurs mid-transaction.

### 3. ⚔️ Battle & Deck Building `🔜 Coming soon`

A battle and deck-building system will be developed once the first two systems are fully operational on the frontend.

## Modules

```
auth/           → Register, login, JWT
users/          → Profile, inventory, statistics, privacy
cards/          → Cards with image upload and optimization
card-sets/      → Card sets to complete
boosters/       → Purchase, opening, drop rates, rarity guarantees
bundles/        → Packs containing cards and boosters
quests/         → Quests (daily/weekly/monthly) + one-shot achievements
transactions/   → Marketplace, listings, atomic purchases, history
images/         → Image upload and optimization (Sharp + ImgBB)
```

## Features by Role

### 👑 Admin

- Full dashboard to manage all application content
- Create and manage cards, sets, boosters, bundles, quests
- Enable/disable content without deletion
- Access the full user list

### 👤 User

**Collection Space**

- Buy boosters and bundles from the in-game shop
- Open boosters with drop rate management and rarity guarantees
- Browse and filter inventory

**Profile Space**

- Level dynamically calculated from accumulated experience
- Detailed statistics (boosters opened, cards bought/sold, gold spent...)
- Quest tracking and reward claiming
- Profile privacy management

**Marketplace Space**

- List cards, boosters and bundles for sale
- Purchase listings from other players
- Paginated transaction history

## Tests

```
✅ auth         → service + controller
✅ users        → service + controller
✅ cards        → service + controller
✅ card-sets    → service + controller
✅ boosters     → service + controller
✅ bundles      → service + controller
✅ quests       → service + controller
✅ transactions → service + controller
```

```bash
npm run test            # Run all tests
npm run test:watch      # Watch mode
npm run test auth       # Test a specific module
npm run test:cov        # Code coverage
```

## Roadmap

- [x] Modular NestJS architecture
- [x] JWT authentication
- [x] Card management with image upload
- [x] Booster system with drop rates
- [x] Bundle system
- [x] Quests and achievements
- [x] Marketplace with atomic transactions
- [x] Jest unit tests : all modules
- [ ] Postman integration tests : in progress
- [ ] Next.js frontend
- [ ] Battle system
- [ ] Deck building
- [ ] E2E tests
- [ ] Production deployment

## Installation

```bash
# Clone the project
git clone <repo-url>
cd cardcollect-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# → Fill in the values in .env

# Run in development
npm run start:dev
```

## Environment Variables

```env
DB_HOST=        # Database host
DB_USER=        # MySQL user
DB_PASSWORD=    # MySQL password
DB_NAME=        # Database name
JWT_SECRET=     # Secret key to sign JWT tokens
IMGBB_API_KEY=  # ImgBB API key for image upload
```
