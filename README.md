# 🛡️ Canton Stealth Procurement (CSP)

## Vue d'ensemble

Canton Stealth Procurement est un système de marchés publics/privés décentralisé et confidentiel construit sur Canton Network avec Daml. Il permet des appels d'offres totalement aveugles où les participants ne peuvent pas observer les offres des autres, éliminant ainsi le front-running et protégeant les secrets commerciaux.

## Problématique

Dans les secteurs industriels sensibles (Défense, Énergie, Infrastructure), la transparence des appels d'offres crée des risques :

- **Espionnage stratégique** : Les concurrents analysent les volumes pour deviner les stratégies
- **Érosion des marges** : Les fournisseurs actuels ajustent leurs prix en voyant les offres concurrentes
- **Distorsion du marché** : Les participants s'observent au lieu de proposer leur meilleur prix réel
- **Front-running** : Sur les blockchains publiques, les offres en attente sont visibles et exploitables

## Solution Architecture

### Entités du Système

1. **Buyer (Acheteur)** : Crée les appels d'offres et attribue les contrats
2. **Supplier (Fournisseur)** : Soumet des offres scellées
3. **Regulator (Régulateur)** : Observer avec accès en lecture seule pour compliance

### Smart Contracts Daml

#### 1. ProcurementRequest (Appel d'Offres)
- **Propriétaire** : Buyer
- **Observers** : Suppliers invités, Regulator
- **Données** :
  - Description du besoin
  - Critères de sélection
  - Deadline de soumission
  - Liste des fournisseurs invités
  - Statut (Open, Closed, Awarded)
- **Choix** :
  - `SubmitBid` : Permet à un supplier de créer une offre scellée
  - `RevealAndAward` : Révèle toutes les offres et attribue au meilleur prix
  - `CancelProcurement` : Annule l'appel d'offres

#### 2. SealedBid (Offre Scellée)
- **Propriétaire** : Supplier
- **Observers** : Buyer (voit qu'une offre existe, pas le montant), Regulator
- **Données** :
  - Référence au ProcurementRequest
  - Hash du montant (pour prévenir modification)
  - Montant réel (visible uniquement par le supplier)
  - Description technique
  - Timestamp de soumission
- **Choix** :
  - `RevealBid` : Utilisé par le Buyer lors du dénouement
  - `WithdrawBid` : Permet au supplier de retirer son offre avant deadline

#### 3. ProcurementContract (Contrat Attribué)
- **Signataires** : Buyer, Winning Supplier
- **Observers** : Regulator
- **Données** :
  - Référence au ProcurementRequest original
  - Montant final
  - Supplier gagnant
  - Conditions d'exécution
  - Statut d'exécution
- **Choix** :
  - `ConfirmDelivery` : Buyer confirme la livraison
  - `PaySupplier` : Déclenche le paiement
  - `DisputeContract` : Ouvre un litige

#### 4. AuditLog (Traçabilité)
- **Propriétaire** : Système
- **Observers** : Regulator
- **Données** :
  - Type d'événement (Request Created, Bid Submitted, Contract Awarded, etc.)
  - Timestamp
  - Parties impliquées
  - Hash des données sensibles
  - Métadonnées pour compliance

### Fonctionnalités Canton

#### Sub-Transaction Privacy
- Chaque SealedBid est visible uniquement par le Supplier et le Buyer
- Les autres Suppliers ne voient pas qu'il y a d'autres participants
- Pas de Mempool visible = pas de front-running possible

#### Point-to-Point Transactions
- Communication directe Buyer ↔ Supplier
- Aucune diffusion globale des offres
- Protection totale des conditions commerciales

#### Observer Pattern pour Compliance
- Le Regulator a un accès en lecture sur tous les contrats
- Il peut auditer sans participer aux transactions
- Traçabilité complète pour les autorités

## Cas d'Usage Réels

### Goldman Sachs - Rachat d'Actifs
Goldman orchestr un rachat d'actifs pour un client institutionnel. Avec CSP :
- Chaque contrepartie soumet une offre sans savoir que d'autres sont consultées
- Protection des marges et conditions spéciales
- Impossibilité de collusion entre contreparties

### EDF - Achat de Turbines
EDF lance un appel d'offres pour 50 turbines. Avec CSP :
- Les concurrents ne peuvent pas deviner la stratégie de production d'EDF
- Les fournisseurs ne voient pas les prix des autres
- Protection contre l'espionnage industriel

### SNCF - Approvisionnement en Acier
SNCF achète des rails. Avec CSP :
- Les volumes restent confidentiels
- Les fournisseurs proposent leur meilleur prix sans référence au marché
- Audit par la Cour des Comptes via le rôle Observer

## Flux de Transaction Typique

```
1. Buyer crée ProcurementRequest
   ├─> Invite Supplier A, B, C
   ├─> Définit deadline: T+7 jours
   └─> Ajoute Regulator comme Observer

2. Supplier A soumet SealedBid (100M€)
   ├─> Voit uniquement sa propre offre
   └─> Buyer voit qu'une offre existe (pas le montant)

3. Supplier B soumet SealedBid (95M€)
   ├─> Ne sait pas que A a soumis
   └─> Propose son meilleur prix réel

4. Supplier C soumet SealedBid (110M€)
   └─> Isolé des autres participants

5. Deadline atteinte (T+7 jours)
   └─> Buyer exécute RevealAndAward

6. Smart Contract dévoile les offres
   ├─> Archive SealedBid de A (100M€)
   ├─> Archive SealedBid de C (110M€)
   ├─> Crée ProcurementContract avec B (95M€)
   └─> Génère AuditLog pour Regulator

7. Execution du contrat
   ├─> B livre les biens/services
   ├─> Buyer confirme avec ConfirmDelivery
   └─> Paiement déclenché automatiquement
```

## Avantages Compétitifs

### vs. Plateformes Classiques (SAP Ariba, Oracle)
- **Confidentialité** : Aucune visibilité inter-fournisseurs
- **Décentralisation** : Pas de point de défaillance unique
- **Immutabilité** : Impossible de modifier les offres après soumission

### vs. Blockchains Publiques (Ethereum)
- **Privacy** : Pas de Mempool publique
- **Anti-MEV** : Impossible de faire du front-running
- **Compliance** : Rôle Observer pour régulateurs

### vs. Systèmes Privés Centralisés
- **Transparence audit** : Le régulateur voit tout
- **Pas de "tricherie admin"** : Smart contracts immuables
- **Multi-juridiction** : Canton Network global

## Testcases à Implémenter

### Test 1: Création et soumission basique
- Buyer crée un ProcurementRequest
- 3 Suppliers soumettent des offres
- Vérifier isolation complète

### Test 2: Dénouement et attribution
- Révélation des offres à deadline
- Attribution au meilleur prix
- Archivage des offres perdantes

### Test 3: Tentative de front-running
- Supplier A soumet 100M€
- Supplier B tente de voir l'offre de A avant de soumettre
- Doit échouer (privacy)

### Test 4: Audit par régulateur
- Regulator accède aux AuditLogs
- Vérifie conformité du processus
- Ne peut pas modifier les contrats

### Test 5: Retrait d'offre
- Supplier soumet une offre
- Se rétracte avant deadline
- Offre archivée proprement

### Test 6: Annulation d'appel d'offres
- Buyer annule avant deadline
- Toutes les offres archivées
- AuditLog généré

### Test 7: Exécution complète du contrat
- Attribution → Livraison → Paiement
- Statuts mis à jour correctement
- Traçabilité complète

### Test 8: Gestion de litige
- Problème lors de l'exécution
- DisputeContract déclenché
- Processus de résolution

### Test 9: Tentative de soumission hors délai
- Supplier tente de soumettre après deadline
- Doit échouer avec erreur explicite

### Test 10: Vérification du hash
- Offre soumise avec montant
- Hash vérifié lors du reveal
- Impossibilité de tricher sur le montant

### Test 11: Multi-critères (prix + qualité)
- Évaluation composite
- Pas uniquement le prix le plus bas
- Score pondéré

### Test 12: Gros volume de fournisseurs
- 20+ suppliers
- Performance du reveal
- Scalabilité

## Métriques de Succès

1. **Privacy Score** : 0 fuite d'information inter-fournisseurs
2. **Latence** : Dénouement < 5 secondes pour 20 offres
3. **Audit Coverage** : 100% des transactions loggées
4. **Anti-Front-Running** : 0 possibilité technique de sniping

## Installation et Déploiement

```bash
# Build du projet
daml build

# Tests
daml test

# Démarrage Canton localnet
canton -c canton-config.conf

# Déploiement
daml ledger upload-dar .daml/dist/dark-pool-0.0.1.dar
```

## Structure du Code

```
daml/
├── Main.daml                    # Types et structures communes
├── ProcurementRequest.daml      # Appels d'offres
├── SealedBid.daml              # Offres scellées
├── ProcurementContract.daml    # Contrats attribués
├── AuditLog.daml               # Traçabilité
└── Tests/
    ├── BasicFlow.daml          # Tests de flux basique
    ├── PrivacyTests.daml       # Tests d'isolation
    ├── ComplianceTests.daml    # Tests audit
    └── EdgeCases.daml          # Tests de cas limites
```

## Roadmap

- [x] Phase 1 : Architecture et design
- [ ] Phase 2 : Implémentation des smart contracts
- [ ] Phase 3 : Tests complets
- [ ] Phase 4 : Frontend (React + Daml ledger API)
- [ ] Phase 5 : Déploiement Canton testnet
- [ ] Phase 6 : Production sur Canton Network

## Auteurs

Projet développé pour le Hackathon Canton Network 2026

## License

MIT License (ou selon les termes du hackathon)
