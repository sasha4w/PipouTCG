# Boîte de réception (notifications) — design

Date : 2026-10-11 · Branche : `feat/admin-duel-sandbox`

## Objectif

Remplacer la modal « Quêtes à réclamer » (`QuestInboxWidget`) par une boîte mail persistée qui prévient le joueur d'une vente réussie, d'un drop rare ou nouveau, d'une quête terminée et d'un patchnote, avec les onglets **Tout / Information / Récompense**.

## Décisions validées

1. **Persistance en BDD** (pas de stockage client seul) : les événements hors-ligne sont conservés, l'état lu est partagé entre appareils.
2. **Classement des types**

| Type | Onglet | Action |
|---|---|---|
| `QUEST_COMPLETED` | Récompense | bouton Réclamer, reste non lu jusqu'à la réclamation |
| `CARD_DROP` | Récompense | lien vers la collection |
| `LISTING_SOLD` | Information | lien vers le marché (l'or est déjà crédité) |
| `PATCHNOTE` | Information | texte déplié en place |

3. **Patchnotes via l'admin** : formulaire dans le dashboard admin ; une ligne unique diffusée à tous. Les nouveaux joueurs voient les patchnotes des 30 derniers jours.
4. **Drops** : un message si une carte est `epic` ou plus, ou si c'est une première copie. Un seul message groupé par ouverture de booster. Seuil défini dans `@pipou/shared`.
5. **Conteneur** : dropdown conservé et étoffé (icône enveloppe + badge de non lus). Pas de page `/inbox` pour l'instant.

## Backend

### Entité `Notification` (migration TypeORM)

`id`, `userId`, `type`, `category` (dérivée du type), `payload` (JSON), `readAt` nullable, `createdAt`.

### Patchnotes

Table `Patchnote` (titre, texte, `createdAt`) et table `patchnote_read(userId, patchnoteId)`. Pas de copie par joueur. Fusionnés avec les notifications à la lecture.

### Types partagés (`@pipou/shared`)

Types, catégories, payloads (union discriminé par `type`) et seuil de rareté des drops. Aucune dépendance runtime.

### `NotificationsService`

API unique `notify(userId, type, payload)`. Points d'émission :
- Quêtes : au passage en « terminée ».
- Ventes : à la finalisation d'une transaction.
- Boosters : à l'ouverture, message groupé si le seuil est atteint.

### API

- `GET /notifications?category=&limit=` : messages fusionnés, du plus récent au plus ancien, avec le nombre de non lus.
- `POST /notifications/:id/read`, `POST /notifications/read-all`.
- `POST /admin/patchnotes` (admin uniquement).

### Cycle de vie

- Les messages d'information passent en lu à l'ouverture de la boîte.
- `QUEST_COMPLETED` reste non lu jusqu'à la réclamation.
- Purge des messages lus de plus de 30 jours.

## Frontend

### Composant

`features/inbox/InboxWidget.tsx` remplace `QuestInboxWidget` dans [Header.tsx](../../../apps/frontend/src/components/Header.tsx). Style bordeaux actuel, 430 px, thème clair.

Structure : en-tête (titre + « Tout réclamer (n) » s'il y a plus d'une quête à réclamer), onglets avec compteurs de non lus, 15 messages au plus (icône par type, titre, détail, date relative, point non lu), pied (« Tout marquer comme lu », lien vers les quêtes).

Une ligne de rendu par type, dans un `switch` exhaustif sur l'union partagé.

### Données

- `QUERY_KEYS.notifications`, `notification.service.ts`, hooks `useNotifications(category)` et `useUnreadCount()`.
- Mutations `markRead` / `markAllRead` avec `setQueryData` pour le badge.
- Réclamer une quête invalide `notifications`, `quests`, `profile`.
- Rafraîchissement en direct : le SSE `listing.sold` existant invalide `notifications`. Un flux `notification.created` unique pour tous les types est préféré ; sinon polling de 60 s. À trancher dans le plan selon la facilité côté backend.

### Erreurs

Chargement échoué : message + « Réessayer ». Réclamation échouée : toast via `apiErrorMessage`.

### i18n

Clés fr / en / ko (onglets, types, états vides). Les libellés `RESET_TYPE_LABEL` en dur passent dans i18n.

### Admin

Formulaire « Nouveau patchnote » (titre, texte) dans le dashboard admin.

## Tests

- Backend : service (création, fusion, lu/non lu, seuil de drop).
- Frontend : filtrage par onglet, rendu de chaque type, badge.
- Contrôle visuel Playwright à 430 px avant livraison.

## Hors périmètre

Page `/inbox` dédiée, notifications push, préférences de notification par type.
