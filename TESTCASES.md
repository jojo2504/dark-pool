# 🧪 Canton Stealth Procurement - Test Cases Complets

## Structure des Tests

Tous les tests suivent la méthodologie AAA (Arrange-Act-Assert) et utilisent Daml Script.

---

## 📋 CATÉGORIE 1 : Tests de Flux Basiques

### TC-001: Création d'un ProcurementRequest valide
**Objectif** : Vérifier qu'un Buyer peut créer un appel d'offres

**Préconditions** :
- Parties : Buyer, Regulator

**Étapes** :
1. Buyer crée un ProcurementRequest
   - Title: "Achat Turbines"
   - Description: "50 turbines haute performance"
   - Budget: 150M€
   - Deadline: now + 7 jours
   - Invited suppliers: [SupplierA, SupplierB, SupplierC]

**Assertions** :
- Contrat créé avec succès
- Buyer est signatory
- Regulator est observer
- Statut = Open
- 3 suppliers dans la liste d'invités

**Résultat attendu** : SUCCESS

---

### TC-002: Soumission d'offre scellée valide
**Objectif** : Vérifier qu'un Supplier invité peut soumettre une offre

**Préconditions** :
- ProcurementRequest créé (TC-001)
- SupplierA est dans invited suppliers
- Deadline non atteinte

**Étapes** :
1. SupplierA exerce SubmitBid sur ProcurementRequest
   - Amount: 100_000_000 (100M€)
   - Technical description: "Turbines modèle TX-500"
   - Delivery time: 6 mois

**Assertions** :
- SealedBid créé avec succès
- SupplierA est signatory
- Buyer est observer (mais ne voit pas le montant)
- Hash calculé correctement : SHA256(amount + salt)
- Timestamp enregistré

**Résultat attendu** : SUCCESS

---

### TC-003: Soumission de multiple offres
**Objectif** : Vérifier que plusieurs suppliers peuvent soumettre indépendamment

**Préconditions** :
- ProcurementRequest créé
- 3 suppliers invités : A, B, C

**Étapes** :
1. SupplierA soumet : 100M€
2. SupplierB soumet : 95M€
3. SupplierC soumet : 110M€

**Assertions** :
- 3 SealedBid créés
- Chaque supplier voit uniquement sa propre offre
- Buyer voit qu'il y a 3 offres (sans montants)
- Aucun supplier ne voit les offres des autres

**Résultat attendu** : SUCCESS

---

### TC-004: Révélation et attribution au meilleur prix
**Objectif** : Vérifier le dénouement automatique

**Préconditions** :
- ProcurementRequest avec 3 offres (TC-003)
- Deadline atteinte

**Étapes** :
1. Buyer exerce RevealAndAward
2. Système révèle toutes les offres
3. Compare les montants
4. Attribue à SupplierB (95M€)

**Assertions** :
- ProcurementContract créé avec SupplierB
- Montant = 95M€
- SealedBid de A et C archivés
- SealedBid de B archivé (transformé en contract)
- ProcurementRequest archivé
- AuditLog créé avec tous les détails

**Résultat attendu** : SUCCESS

---

## 🔒 CATÉGORIE 2 : Tests de Privacy et Isolation

### TC-101: Isolation des offres entre suppliers
**Objectif** : Vérifier qu'un supplier ne peut pas voir les autres offres

**Préconditions** :
- ProcurementRequest créé
- SupplierA a soumis 100M€

**Étapes** :
1. SupplierB tente de querier les contracts visibles
2. Cherche SealedBid de SupplierA

**Assertions** :
- SupplierB voit uniquement ProcurementRequest
- SupplierB ne voit PAS le SealedBid de A
- SupplierB ne voit même pas qu'une offre existe

**Résultat attendu** : SUCCESS (isolation totale)

---

### TC-102: Buyer voit l'existence mais pas le montant
**Objectif** : Vérifier que Buyer voit qu'il y a des offres sans les montants

**Préconditions** :
- ProcurementRequest créé
- 2 offres soumises

**Étapes** :
1. Buyer query ses contracts visibles
2. Cherche les SealedBids

**Assertions** :
- Buyer voit 2 SealedBids (en tant qu'observer)
- Buyer NE voit PAS les montants (field privé)
- Buyer voit les suppliers et timestamps
- Buyer ne peut PAS exercer de choix sur SealedBid avant deadline

**Résultat attendu** : SUCCESS

---

### TC-103: Tentative de front-running
**Objectif** : Vérifier l'impossibilité de copier/modifier une offre

**Préconditions** :
- SupplierA soumet 100M€ à T
- SupplierB observe (hypothétiquement)

**Étapes** :
1. SupplierB tente de voir l'offre de A
2. SupplierB soumet sa propre offre à T+1

**Assertions** :
- SupplierB ne peut pas voir l'offre de A
- SupplierB doit soumettre sans information
- Pas de "mempool" visible
- Ordre de soumission n'avantage personne

**Résultat attendu** : SUCCESS (protection totale)

---

### TC-104: Vérification d'intégrité via hash
**Objectif** : Vérifier qu'on ne peut pas modifier le montant après soumission

**Préconditions** :
- SupplierA soumet 100M€ avec hash

**Étapes** :
1. Stocker hash initial : H1 = SHA256(100_000_000 + salt)
2. Tenter de modifier le montant dans le SealedBid (hypothétique)
3. Lors du reveal, recalculer le hash : H2

**Assertions** :
- H1 == H2 doit être TRUE
- Si différent, offre rejetée
- Immutabilité garantie par Daml

**Résultat attendu** : SUCCESS (intégrité préservée)

---

## 👮 CATÉGORIE 3 : Tests d'Audit et Compliance

### TC-201: Regulator voit tous les contrats
**Objectif** : Vérifier que le régulateur a accès complet en lecture

**Préconditions** :
- Flux complet : Request → Bids → Award

**Étapes** :
1. Regulator query ses contracts visibles

**Assertions** :
- Regulator voit ProcurementRequest
- Regulator voit tous les SealedBids (avec montants)
- Regulator voit ProcurementContract final
- Regulator voit tous les AuditLogs
- Regulator ne peut RIEN modifier (observer only)

**Résultat attendu** : SUCCESS

---

### TC-202: AuditLog contient toute la traçabilité
**Objectif** : Vérifier que chaque action génère un log

**Préconditions** :
- Flux complet exécuté

**Étapes** :
1. Query tous les AuditLogs

**Assertions** :
- Log "REQUEST_CREATED" existe
- Log "BID_SUBMITTED" pour chaque offre (3x)
- Log "BIDS_REVEALED" existe
- Log "CONTRACT_AWARDED" existe
- Chaque log a timestamp, parties, et hash

**Résultat attendu** : SUCCESS

---

### TC-203: Regulator ne peut pas modifier
**Objectif** : Vérifier que observer ne peut pas être signatory

**Préconditions** :
- ProcurementRequest existe

**Étapes** :
1. Regulator tente d'exercer RevealAndAward
2. Regulator tente de créer un SealedBid

**Assertions** :
- Échec avec erreur "Missing authorization"
- Regulator reste en lecture seule
- Aucune modification possible

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-204: Auditabilité post-award
**Objectif** : Vérifier qu'on peut retracer tout le processus après coup

**Préconditions** :
- Contrat attribué et exécuté

**Étapes** :
1. Regulator reconstruit la timeline via AuditLogs
2. Vérifie cohérence des montants
3. Vérifie respect de la deadline

**Assertions** :
- Timeline complète disponible
- Pas de trous dans les logs
- Montants cohérents
- Gagnant = meilleur prix vérifié

**Résultat attendu** : SUCCESS

---

## ⏰ CATÉGORIE 4 : Tests de Deadline et Timing

### TC-301: Soumission après deadline échoue
**Objectif** : Vérifier qu'on ne peut pas soumettre en retard

**Préconditions** :
- ProcurementRequest avec deadline = T
- Time now = T + 1 jour

**Étapes** :
1. SupplierD tente de soumettre une offre

**Assertions** :
- Échec avec erreur "Deadline passed"
- Aucun SealedBid créé
- ProcurementRequest inchangé

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-302: Révélation avant deadline échoue
**Objectif** : Vérifier qu'on ne peut pas révéler trop tôt

**Préconditions** :
- ProcurementRequest avec deadline = T
- Time now = T - 1 jour
- 2 offres soumises

**Étapes** :
1. Buyer tente d'exercer RevealAndAward

**Assertions** :
- Échec avec erreur "Deadline not reached"
- SealedBids restent scellés
- Pas de révélation prématurée

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-303: Retrait d'offre avant deadline
**Objectif** : Vérifier qu'un supplier peut se rétracter

**Préconditions** :
- SupplierA a soumis une offre
- Deadline non atteinte

**Étapes** :
1. SupplierA exerce WithdrawBid

**Assertions** :
- SealedBid archivé
- AuditLog "BID_WITHDRAWN" créé
- Supplier peut soumettre une nouvelle offre

**Résultat attendu** : SUCCESS

---

### TC-304: Retrait après deadline échoue
**Objectif** : Vérifier qu'on ne peut plus se rétracter après deadline

**Préconditions** :
- SupplierA a soumis une offre
- Deadline atteinte

**Étapes** :
1. SupplierA tente d'exercer WithdrawBid

**Assertions** :
- Échec avec erreur "Deadline passed, cannot withdraw"
- SealedBid reste actif
- Offre engageante

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

## 🚫 CATÉGORIE 5 : Tests de Contrôles d'Accès

### TC-401: Supplier non invité ne peut pas soumettre
**Objectif** : Vérifier que seuls les invités peuvent participer

**Préconditions** :
- ProcurementRequest invite [A, B, C]
- SupplierD existe mais non invité

**Étapes** :
1. SupplierD tente d'exercer SubmitBid

**Assertions** :
- Échec avec erreur "Not in invited suppliers"
- Aucun SealedBid créé
- Liste d'invités inchangée

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-402: Supplier ne peut pas révéler lui-même
**Objectif** : Vérifier que seul Buyer peut révéler

**Préconditions** :
- SealedBid de SupplierA existe
- Deadline atteinte

**Étapes** :
1. SupplierA tente d'exercer RevealBid directement

**Assertions** :
- Échec avec erreur "Only buyer can reveal"
- Offre reste scellée
- Confidentialité préservée

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-403: Buyer différent ne peut pas accéder
**Objectif** : Vérifier l'isolation entre différents buyers

**Préconditions** :
- BuyerA crée un ProcurementRequest
- BuyerB existe indépendamment

**Étapes** :
1. BuyerB tente de voir le ProcurementRequest de BuyerA
2. BuyerB tente d'exercer RevealAndAward

**Assertions** :
- BuyerB ne voit pas le contrat
- Échec avec erreur "Not authorized"
- Isolation complète entre acheteurs

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-404: Double soumission du même supplier échoue
**Objectif** : Vérifier qu'on ne peut soumettre qu'une fois

**Préconditions** :
- SupplierA a déjà soumis une offre

**Étapes** :
1. SupplierA tente de soumettre une 2ème offre

**Assertions** :
- Échec avec erreur "Already submitted a bid"
- Une seule offre par supplier
- Doit withdraw puis re-submit si besoin

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

## 💼 CATÉGORIE 6 : Tests d'Exécution de Contrat

### TC-501: Exécution complète du contrat attribué
**Objectif** : Vérifier le cycle de vie complet

**Préconditions** :
- ProcurementContract attribué à SupplierB

**Étapes** :
1. SupplierB livre les biens
2. Buyer exerce ConfirmDelivery
3. Système change statut à "Delivered"
4. Buyer exerce PaySupplier
5. Statut change à "Paid"

**Assertions** :
- Chaque transition de statut loggée
- AuditLogs créés à chaque étape
- Contrat finalisé correctement

**Résultat attendu** : SUCCESS

---

### TC-502: Ouverture de litige
**Objectif** : Vérifier la gestion des désaccords

**Préconditions** :
- ProcurementContract en cours
- Problème lors de la livraison

**Étapes** :
1. Buyer exerce DisputeContract avec raison
2. Statut change à "Disputed"
3. AuditLog créé

**Assertions** :
- Statut "Disputed" enregistré
- Raison du litige loggée
- Processus de résolution enclenché
- Paiement bloqué

**Résultat attendu** : SUCCESS

---

### TC-503: Paiement sans confirmation échoue
**Objectif** : Vérifier qu'on doit confirmer avant de payer

**Préconditions** :
- ProcurementContract attribué
- Statut = "Awarded" (pas encore delivered)

**Étapes** :
1. Buyer tente d'exercer PaySupplier directement

**Assertions** :
- Échec avec erreur "Delivery not confirmed"
- Statut reste "Awarded"
- Pas de paiement prématuré

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

## 🎯 CATÉGORIE 7 : Tests de Cas Limites

### TC-601: Aucune offre soumise
**Objectif** : Vérifier le comportement si 0 offre

**Préconditions** :
- ProcurementRequest créé
- Deadline atteinte
- 0 SealedBids

**Étapes** :
1. Buyer exerce RevealAndAward

**Assertions** :
- Échec avec erreur "No bids to reveal"
- OU ProcurementRequest archivé sans attribution
- AuditLog "NO_BIDS_RECEIVED" créé

**Résultat attendu** : SUCCESS (gestion gracieuse)

---

### TC-602: Toutes les offres retirées
**Objectif** : Vérifier le comportement si tous withdrawent

**Préconditions** :
- 3 offres soumises
- Les 3 withdrawées avant deadline

**Étapes** :
1. Deadline atteinte
2. Buyer tente RevealAndAward

**Assertions** :
- Comportement identique à TC-601
- Tous les SealedBids déjà archivés
- Pas d'attribution possible

**Résultat attendu** : SUCCESS (gestion gracieuse)

---

### TC-603: Offres avec montants égaux
**Objectif** : Vérifier le départage en cas d'égalité

**Préconditions** :
- SupplierA soumet 100M€ à T1
- SupplierB soumet 100M€ à T2

**Étapes** :
1. Buyer exerce RevealAndAward

**Assertions** :
- Attribution à SupplierA (premier arrivé)
- OU critère secondaire (qualité, délai)
- Décision documentée dans AuditLog

**Résultat attendu** : SUCCESS (règle de départage claire)

---

### TC-604: Annulation de l'appel d'offres
**Objectif** : Vérifier que Buyer peut annuler

**Préconditions** :
- ProcurementRequest avec 2 offres
- Deadline non atteinte

**Étapes** :
1. Buyer exerce CancelProcurement avec raison

**Assertions** :
- ProcurementRequest archivé
- Tous les SealedBids archivés
- AuditLog "PROCUREMENT_CANCELLED" créé
- Raison de l'annulation enregistrée

**Résultat attendu** : SUCCESS

---

### TC-605: Montant négatif ou zéro rejeté
**Objectif** : Vérifier la validation des montants

**Préconditions** :
- ProcurementRequest créé

**Étapes** :
1. SupplierA tente de soumettre avec amount = -1000
2. SupplierB tente de soumettre avec amount = 0

**Assertions** :
- Échec avec erreur "Amount must be positive"
- Aucun SealedBid créé
- Validation au niveau du contrat

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

## 📊 CATÉGORIE 8 : Tests de Performance et Scalabilité

### TC-701: 20 suppliers en parallèle
**Objectif** : Vérifier la scalabilité

**Préconditions** :
- ProcurementRequest invite 20 suppliers

**Étapes** :
1. Les 20 suppliers soumettent simultanément
2. Buyer révèle toutes les offres

**Assertions** :
- Toutes les soumissions réussies
- Révélation en < 10 secondes
- Gagnant correct identifié
- Aucune corruption de données

**Résultat attendu** : SUCCESS

---

### TC-702: Multiple procurements en parallèle
**Objectif** : Vérifier l'isolation entre appels d'offres

**Préconditions** :
- 3 Buyers créent 3 ProcurementRequests différents
- Mêmes suppliers invités aux 3

**Étapes** :
1. Suppliers soumettent à chaque procurement
2. Buyers révèlent indépendamment

**Assertions** :
- Isolation complète entre les 3
- Pas de confusion entre contrats
- Chaque procurement attribué correctement

**Résultat attendu** : SUCCESS

---

## 📈 CATÉGORIE 9 : Tests d'Intégration Multi-Critères

### TC-801: Évaluation prix + qualité
**Objectif** : Vérifier qu'on peut pondérer plusieurs critères

**Préconditions** :
- ProcurementRequest avec critères :
  - Prix : 60%
  - Qualité : 30%
  - Délai : 10%

**Étapes** :
1. SupplierA : 100M€, qualité 8/10, 6 mois
2. SupplierB : 95M€, qualité 6/10, 8 mois
3. SupplierC : 105M€, qualité 10/10, 4 mois
4. Calcul des scores pondérés

**Assertions** :
- Score A = (100/100)*0.6 + (8/10)*0.3 + (6/6)*0.1 = 0.6 + 0.24 + 0.167 = 1.007
- Score B = ...
- Score C = ...
- Gagnant = meilleur score composite

**Résultat attendu** : SUCCESS

---

### TC-802: Critères d'exclusion
**Objectif** : Vérifier les seuils minimaux

**Préconditions** :
- ProcurementRequest exige :
  - Délai max : 6 mois
  - Qualité min : 7/10

**Étapes** :
1. SupplierA : 90M€, qualité 6/10 → exclu
2. SupplierB : 100M€, qualité 8/10, 8 mois → exclu
3. SupplierC : 110M€, qualité 9/10, 5 mois → qualifié

**Assertions** :
- A et B exclus (ne répondent pas aux critères)
- C gagne par défaut
- AuditLog documente les exclusions

**Résultat attendu** : SUCCESS

---

## 🔐 CATÉGORIE 10 : Tests de Sécurité Avancés

### TC-901: Tentative de replay attack
**Objectif** : Vérifier l'unicité des transactions

**Préconditions** :
- SupplierA a soumis une offre

**Étapes** :
1. Capturer la transaction SubmitBid
2. Tenter de la rejouer

**Assertions** :
- Échec (ContractId unique déjà consommé)
- Daml prévient naturellement le replay
- Aucune duplication possible

**Résultat attendu** : FAILURE (échec attendu = succès du test)

---

### TC-902: Tentative de manipulation du timestamp
**Objectif** : Vérifier l'intégrité temporelle

**Préconditions** :
- SupplierA soumet à T1

**Étapes** :
1. Tenter de modifier le timestamp dans SealedBid
2. Révéler les offres

**Assertions** :
- Timestamp immutable (Daml garantit)
- Ordre de soumission préservé
- Aucune manipulation possible

**Résultat attendu** : SUCCESS (intégrité garantie)

---

### TC-903: Tentative de collision de hash
**Objectif** : Vérifier la robustesse du hashing

**Préconditions** :
- Utilisation de SHA256

**Étapes** :
1. Générer 1000 offres avec montants aléatoires
2. Calculer tous les hashes
3. Chercher des collisions

**Assertions** :
- Probabilité de collision négligeable (< 2^-256)
- Chaque montant a un hash unique
- Intégrité cryptographique garantie

**Résultat attendu** : SUCCESS

---

## 📝 Résumé des Catégories

| Catégorie | Nombre de Tests | Priorité |
|-----------|----------------|----------|
| Flux Basiques | 4 | P0 |
| Privacy & Isolation | 4 | P0 |
| Audit & Compliance | 4 | P0 |
| Deadline & Timing | 4 | P1 |
| Contrôles d'Accès | 4 | P1 |
| Exécution Contrat | 3 | P1 |
| Cas Limites | 5 | P2 |
| Performance | 2 | P2 |
| Multi-Critères | 2 | P2 |
| Sécurité Avancée | 3 | P2 |
| **TOTAL** | **35 tests** | |

## 🎯 Stratégie d'Exécution

1. **Phase 1** : Tests P0 (12 tests) - Fonctionnalités critiques
2. **Phase 2** : Tests P1 (11 tests) - Robustesse
3. **Phase 3** : Tests P2 (12 tests) - Edge cases et optimisation

## 🔧 Outils de Test

- **Daml Script** : Tous les tests automatisés
- **Canton Sandbox** : Environnement d'exécution local
- **Assertions Daml** : Vérifications natives
- **Mocks** : Simulation de temps (pour deadlines)

## 📊 Critères de Réussite

- ✅ 100% des tests P0 passent
- ✅ 95%+ des tests P1 passent
- ✅ 80%+ des tests P2 passent
- ✅ Code coverage > 90%
- ✅ 0 vulnérabilité de sécurité

---

**Note** : Ces testcases servent de spécification fonctionnelle autant que de suite de tests. Chaque test sera implémenté en Daml Script dans le dossier `daml/Tests/`.
