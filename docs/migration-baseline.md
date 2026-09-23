# Baseline avant migration (2026-09-23)

Relevé sur les dépôts d'origine (`tcg-backend@master`, `tcg-frontend@main`), Node 20.18, npm.
Le `node_modules` du front était incomplet (`zustand` et `vitest` manquants) : `npm ci` a été relancé avant la mesure.

| App | lint | typecheck | tests | build |
|---|---|---|---|---|
| backend | exit 1 : 366 problèmes (304 erreurs, 62 warnings) | exit 0 | 56 échoués / 132 passés (14 suites en échec sur 19) | exit 0 |
| frontend | exit 1 : 134 problèmes (120 erreurs, 14 warnings) | exit 0 | 63 / 63 passés (6 fichiers) | exit 0 |

Règles de lint les plus fréquentes :
- backend : `prettier/prettier` (104), `no-unsafe-member-access` (82), `no-unsafe-assignment` (50), `allowDefaultProject` (23), `no-unused-vars` (14)
- frontend : `no-explicit-any` (88), `react-refresh/only-export-components` (4), `no-unused-vars` (4), `ban-types` (4)

Conséquence pour la CI : le lint n'est **pas** bloquant tant que ces erreurs existent, et les tests backend non plus (voir la liste ci-dessous). La CI ne doit pas faire pire que cette baseline.

## Tests backend en échec avant migration (56)

- AppController › root › should return "Hello World!"
- AuthController › login › should call authService.login with email and password
- AuthService › login › should return access_token and empty autoClaimedRewards
- AuthService › register › should hash password and return user without sensitive fields
- BoostersController › buyBooster › should call buyBooster with boosterId and userId
- BoostersService › buyBooster › should buy booster if enough gold
- BoostersService › buyBooster › should throw BadRequestException if not enough gold
- BoostersService › buyBooster › should throw NotFoundException if booster not found
- BoostersService › buyBooster › should throw NotFoundException if user not found
- BoostersService › create › should create and save booster
- BoostersService › findAll › should return paginated boosters
- BoostersService › findOne › should return booster if found
- BoostersService › findOne › should throw NotFoundException if not found
- BoostersService › openBooster - card counts & guarantees › should draw 1 card for CardNumber.ONE
- BoostersService › openBooster - card counts & guarantees › should draw 10 cards + 1 RARE + 1 EPIC garanties for CardNumber.TEN
- BoostersService › openBooster - card counts & guarantees › should draw 5 cards for CardNumber.FIVE
- BoostersService › openBooster - card counts & guarantees › should draw 8 cards + 1 RARE garantie for CardNumber.EIGHT
- BoostersService › openBooster - errors › should throw BadRequestException if no cards in set
- BoostersService › openBooster - errors › should throw if booster not in inventory
- BoostersService › remove › should remove booster and return message
- BoostersService › update › should throw NotFoundException if booster not found
- BoostersService › update › should update and save booster
- BundlesController › buyBundle › should call buyBundle with bundleId and userId
- BundlesService › addContent › should throw if totalQuantity < 2
- BundlesService › openBundle › should open bundle and return summary
- BundlesService › remove › should remove bundle
- ImagesService › remove › should delete on ImgBB via deleteUrl and remove from DB
- ImagesService › uploadAndSave › should optimize, upload to ImgBB and save in DB
- ImagesService › uploadAndSave › should slugify name with accents correctly
- TransactionController › buyListing › should call buyListing with transactionId and userId
- TransactionController › getHistory › should return user transaction history
- TransactionService › buyListing › should complete a BOOSTER transaction
- TransactionService › buyListing › should complete a BUNDLE transaction
- TransactionService › buyListing › should complete a CARD transaction
- TransactionService › buyListing › should increment buyerItem quantity if buyer already owns the card
- TransactionService › buyListing › should throw if buyer does not have enough gold
- TransactionService › buyListing › should throw if buyer is the seller
- TransactionService › buyListing › should throw if buyer not found
- TransactionService › buyListing › should throw if listing already sold
- TransactionService › buyListing › should throw if listing not found
- TransactionService › createListing › ProductType.BOOSTER › should create listing and reserve booster quantity
- TransactionService › createListing › ProductType.BOOSTER › should throw if not enough booster quantity
- TransactionService › createListing › ProductType.BUNDLE › should create listing and reserve bundle quantity
- TransactionService › createListing › ProductType.BUNDLE › should throw if not enough bundle quantity
- TransactionService › createListing › ProductType.CARD › should create listing and reserve card quantity
- TransactionService › createListing › ProductType.CARD › should throw if card not owned by seller
- TransactionService › createListing › ProductType.CARD › should throw if not enough card quantity
- TransactionService › createListing › should throw if seller not found
- TransactionService › findAll › should return paginated pending listings
- TransactionService › getUserHistory › should return paginated transaction history
- TransactionService › getUserHistory › should use default pagination if not provided
- UsersController › getInventory › should return inventory if owner
- UsersController › getMyInventory › should return current user inventory
- UsersService › findOne › should return null if user not found
- UsersService › saveResetToken › should update user with token and expiry
- UsersService › updatePassword › should update password and clear reset token
