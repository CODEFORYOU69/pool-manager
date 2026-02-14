# Plan d'implémentation : Mode "Poule Unique + Finales"

## Contexte

L'application gère actuellement 2 types de tournois : **Poules** (round-robin multi-poules) et **Élimination directe**. Ce plan décrit l'ajout d'un **3e type : "Poule Unique"** inspiré du format Ligue des Champions :

- **1 poule unique** par catégorie contenant tous les combattants
- **Tirage aléatoire** des adversaires (pas de round-robin complet)
- **K combats par personne** (2, 3 ou 4, choix de l'organisateur)
- **Phase finale** automatique : demi-finales, finale, petite finale

**Modèle** : Config → Tirage (graphe K-régulier) → Planning par tours → Saisie scores → Classement → Finales → Podium.

---

## Interfaces cibles

```typescript
interface Fighter {
  id: string;
  name: string;
  club: string;
  categoryId: string;
}

interface Round {
  redScore: number;
  blueScore: number;
  redPenalties: number;    // gamjeom rouge ce round
  bluePenalties: number;   // gamjeom bleu ce round
  // winner déjà déterminé par scoreA vs scoreB (winnerPosition existant)
}

interface Fight {
  id: string;
  poolId: string;
  tour: number;           // numéro du tour (1, 2, 3...)
  redFighterId: string;
  blueFighterId: string;
  rounds: Round[];         // 3 rounds par combat
  winnerId: string | null; // null si pas encore joué
  phase: 'pool' | 'semi1' | 'semi2' | 'final' | 'bronze';
  // total pénalités = somme des gamjeom de tous les rounds
}

interface PoolStanding {
  fighterId: string;
  victories: number;
  defeats: number;
  roundsWon: number;
  roundsLost: number;
  totalPoints: number;
  totalPointsAgainst: number;
  penalties: number;
  rank: number;
}

interface Pool {
  id: string;
  categoryId: string;
  fighters: Fighter[];
  fightsPerPerson: 2 | 3 | 4;  // choix de l'organisateur
  totalFights: number;          // (N × K) / 2
  fights: Fight[];
  standings: PoolStanding[];
  phase: 'config' | 'draw' | 'pool' | 'finals' | 'completed';
  bronzeMatch: boolean;
}
```

---

## Règle de compatibilité (CRITIQUE)

La formule `totalFights = (N × K) / 2` doit donner un entier.

| K combats | N pair | N impair |
|-----------|--------|----------|
| **2**     | OK     | OK       |
| **3**     | OK     | IMPOSSIBLE (N×3 impair → /2 non entier) |
| **4**     | OK     | OK       |

**Comportement de l'app** :
- Si N impair et K=3 → message d'erreur rouge + griser le bouton "3 combats"
- Proposer 2 ou 4 à la place
- Validation : `(N * K) % 2 === 0`

---

## Décisions d'architecture

| Décision | Choix | Justification |
|----------|-------|---------------|
| Tirage des adversaires | Graphe K-régulier aléatoire | Chaque combattant a exactement K adversaires, pas de round-robin complet |
| Planning | Par tours avec matching maximum | Minimise le nombre de tours, chaque combattant max 1 combat par tour |
| Saisie des scores finales | Réutiliser ScoreInput existant | Pas de duplication, filtre par phase |
| Intégration | 3e type de tournoi (`poolFinals`) | Ne casse pas les modes existants |
| Nommage BDD | A/B conservé en BDD | Rouge/Bleu affiché en UI via mapping |
| Rétrocompatibilité | Champs avec defaults | Les tournois existants fonctionnent sans changement |

---

## Phase 1 : Schema Prisma + Migration

**Fichier** : `api/prisma/schema.prisma`

### Pool — ajouter `phase`, `bronzeMatch`, `fightsPerPerson`

```prisma
model Pool {
  id               String            @id @default(uuid())
  poolIndex        Int
  groupId          String
  phase            String            @default("config")  // 'config' | 'draw' | 'pool' | 'finals' | 'completed'
  bronzeMatch      Boolean           @default(true)
  fightsPerPerson  Int               @default(0)          // 2, 3 ou 4 (0 = mode classique)
  matches          Match[]
  group            Group             @relation(fields: [groupId], references: [id], onDelete: Cascade)
  poolParticipants PoolParticipant[]

  @@unique([poolIndex, groupId])
  @@index([groupId])
}
```

### Match — ajouter `phase`, `tour`

```prisma
model Match {
  id                String             @id @default(uuid())
  matchNumber       Int
  status            String
  startTime         DateTime
  endTime           DateTime?
  winner            String?
  groupId           String
  poolId            String
  areaId            String
  poolIndex         Int
  pointMatch        Int                @default(0)
  phase             String             @default("pool")   // 'pool' | 'semi1' | 'semi2' | 'final' | 'bronze'
  tour              Int                @default(0)         // numéro du tour (1, 2, 3...)
  area              Area               @relation(...)
  group             Group              @relation(...)
  pool              Pool               @relation(...)
  matchParticipants MatchParticipant[]
  rounds            Round[]

  @@index([groupId])
  @@index([poolId])
  @@index([areaId])
}
```

### Round — ajouter `penaltyA`, `penaltyB` (gamjeom par round)

```prisma
model Round {
  id             String   @id @default(uuid())
  roundNumber    Int
  scoreA         Int      @default(0)
  scoreB         Int      @default(0)
  winner         String?
  winnerPosition String?
  penaltyA       Int      @default(0)    // gamjeom position A (rouge) ce round
  penaltyB       Int      @default(0)    // gamjeom position B (bleu) ce round
  matchId        String
  match          Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@unique([matchId, roundNumber])
  @@index([matchId])
}
```

Le total de pénalités par combat = somme des `penaltyA`/`penaltyB` de tous les rounds.

Tous les nouveaux champs ont des valeurs par défaut → **rétrocompatibilité totale**.

**Commande** : `npx prisma migrate dev --name add_pool_finals_fields`

---

## Phase 2 : API (server.js)

**Fichier** : `api/server.js`

### Endpoints existants à modifier

| Endpoint | Modification |
|----------|-------------|
| `POST /api/match` (~ligne 527) | Accepter `phase` et `tour` dans le body |
| `POST /api/match/:id/results` (~ligne 1614) | Accepter et stocker `penaltyA`, `penaltyB` **par round** (dans chaque objet round) |
| `POST /api/pool` (~ligne 341) | Accepter `phase`, `bronzeMatch`, `fightsPerPerson` |

### Nouveaux endpoints

#### `PUT /api/pool/:id/phase`
Met à jour la phase de la poule (`config` → `draw` → `pool` → `finals` → `completed`).

#### `GET /api/pool/:id/standings`
Calcule et retourne le classement de la poule (PoolStanding[]).
- Basé sur les matchs `phase: "pool"` complétés
- Critères : victoires > confrontation directe > rounds gagnés > points > pénalités

#### `POST /api/pool/:id/draw`
Effectue le tirage aléatoire des adversaires.
- Vérifie la compatibilité `(N × K) % 2 === 0`
- Génère un graphe K-régulier aléatoire
- Crée les matchs de poule avec les paires tirées
- Organise les matchs en tours (matching maximum)
- Passe `Pool.phase` à `"pool"`
- Retourne les matchs créés organisés par tour

#### `POST /api/pool/:id/generateFinals`
Génère les matchs de finales à partir du classement.
- Vérifie que tous les matchs `phase: "pool"` sont complétés
- Calcule le classement
- Crée les matchs :
  - **semi1** : Rank 1 vs Rank 4
  - **semi2** : Rank 2 vs Rank 3
  - **final** : placeholder (rempli après les semis)
  - **bronze** : placeholder (si `bronzeMatch === true`)
- Passe `Pool.phase` à `"finals"`

### Logique d'auto-propagation (dans `POST /api/match/:id/results`)

Après sauvegarde du résultat, si `phase === "semi1"` ou `"semi2"` :
1. Chercher les matchs `final` et `bronze` de la même poule
2. Assigner les **gagnants** des 2 semis → participants de la **finale**
3. Assigner les **perdants** des 2 semis → participants de la **petite finale**

---

## Phase 3 : Utilitaires frontend

### 3a. Nouveau fichier : `src/utils/drawGenerator.js`

**Algorithme de tirage — Graphe K-régulier aléatoire :**

```javascript
/**
 * Valide la compatibilité N × K.
 * @param {number} n - nombre de combattants
 * @param {number} k - combats par personne (2, 3 ou 4)
 * @returns {{ valid: boolean, alternatives?: number[] }}
 */
export const validateFightsChoice = (n, k) => {
  if ((n * k) % 2 === 0) return { valid: true };
  return { valid: false, alternatives: [2, 4] };
};

/**
 * Génère un graphe K-régulier aléatoire.
 * Chaque noeud (combattant) a exactement K arêtes (adversaires).
 *
 * @param {string[]} fighterIds - IDs des combattants
 * @param {number} k - combats par personne
 * @returns {Array<[string, string]>} - Liste de paires (combats)
 *
 * Algorithme :
 *   1. Créer une "liste de stubs" : chaque combattant apparaît K fois
 *      Ex: K=2, fighters=[A,B,C,D] → stubs=[A,A,B,B,C,C,D,D]
 *   2. Mélanger aléatoirement (Fisher-Yates)
 *   3. Former des paires consécutives : (stubs[0],stubs[1]), (stubs[2],stubs[3]), ...
 *   4. Valider : pas de self-loop (A vs A), pas de multi-edge (A vs B deux fois)
 *   5. Si invalide → recommencer (max 100 tentatives)
 *   6. Retourner la liste de paires valide
 */
export const generateKRegularDraw = (fighterIds, k) => { ... };
```

**Algorithme de planification par tours :**

```javascript
/**
 * Organise les combats en tours (matching maximum par tour).
 * Chaque combattant ne combat qu'une fois par tour.
 *
 * @param {Array<[string, string]>} fights - Paires de combats
 * @returns {Array<Array<[string, string]>>} - Combats groupés par tour
 *
 * Algorithme glouton :
 *   1. Copier la liste des combats non placés
 *   2. Pour chaque tour :
 *      a. Initialiser un Set "combattants occupés ce tour"
 *      b. Parcourir les combats non placés
 *      c. Si aucun des 2 combattants n'est dans "occupés" → ajouter au tour
 *      d. Marquer les 2 combattants comme occupés
 *   3. Répéter jusqu'à ce que tous les combats soient placés
 */
export const organizeFightsIntoTours = (fights) => { ... };
```

### 3b. Nouveau fichier : `src/utils/finalsGenerator.js`

```javascript
/**
 * Génère les matchs de finales à partir du classement de poule.
 *
 * @param {PoolStanding[]} standings - Classement trié (top 4 minimum)
 * @param {string} poolId
 * @param {string} groupId
 * @param {{ bronzeMatch: boolean }} options
 * @returns {Fight[]} - semi1, semi2, final, bronze
 *
 * Semi 1 : Rank 1 vs Rank 4
 * Semi 2 : Rank 2 vs Rank 3
 * Final  : placeholder (gagnants des semis)
 * Bronze : placeholder (perdants des semis, si activé)
 */
export const generateFinalsMatches = (standings, poolId, groupId, options) => { ... };
```

### 3c. Modifier `src/utils/resultsCalculator.js`

Nouvelle fonction (sans toucher à l'existant) :

```javascript
/**
 * Calcule le classement conforme à l'interface PoolStanding.
 *
 * Critères de tri (priorité stricte) :
 *   1. Victoires (desc)
 *   2. Confrontation directe (si 2 combattants ex-aequo se sont affrontés)
 *   3. Rounds gagnés (desc)
 *   4. Total points marqués (desc)
 *   5. Pénalités reçues (asc — moins = mieux) — somme des gamjeom de tous les rounds
 */
export const calculatePoolStandings = (poolFighters, poolMatches) => { ... };
```

### 3d. Mapping Rouge/Bleu dans `src/utils/constants.js`

```javascript
export const POSITION_LABELS = {
  A: { color: 'red',  label: 'Rouge', shortLabel: 'R' },
  B: { color: 'blue', label: 'Bleu',  shortLabel: 'B' },
};
```

La BDD reste en A/B. L'UI affiche Rouge/Bleu via ce mapping.

---

## Phase 4 : Service layer (dbService.js)

**Fichier** : `src/services/dbService.js`

### Fonctions existantes à modifier

| Fonction | Modification |
|----------|-------------|
| `saveMatchResult()` (~ligne 756) | Inclure `penaltyA`, `penaltyB` **par round** dans le payload de chaque round |
| `fetchFormattedMatches()` (~ligne 1654) | Inclure `phase`, `tour` sur match + `penaltyA`, `penaltyB` sur chaque round |

### Nouvelles fonctions

```javascript
updatePoolPhase(poolId, phase)           // PUT /api/pool/:id/phase
fetchPoolStandings(poolId)               // GET /api/pool/:id/standings
performDraw(poolId)                      // POST /api/pool/:id/draw
generateAndSaveFinals(poolId)            // POST /api/pool/:id/generateFinals
validateFightsChoice(poolId, k)          // Validation locale (N×K)%2
```

---

## Phase 5 : Frontend — Composants

### Vue d'ensemble du flow utilisateur

```
0: CompetitionList        → Sélection/création du tournoi
1: ImportCSV              → Import des participants
2: TournamentSetup        → Type "Poule Unique", nombre de combats (2/3/4), petite finale
3: PoolConfig (NOUVEAU)   → Config par catégorie + validation N×K + tirage aléatoire
4: PoolSchedule (NOUVEAU) → Planning par tours + vue tableau
5: ScoreInput (MODIFIÉ)   → Saisie scores + gamjeom + filtre par phase/tour
6: PoolFinals (NOUVEAU)   → Classement + génération finales + suivi bracket
7: Results (MODIFIÉ)      → Podium + classement complet
```

### 5a. TournamentSetup.js — Nouveau type

**Fichier** : `src/components/TournamentSetup.js`

- Ajouter `"poolFinals"` dans le sélecteur de type :
  ```
  Poules | Poule Unique + Finales | Élimination directe
  ```
- Quand `poolFinals` sélectionné :
  - Sélecteur "Nombre de combats par personne" : 2, 3, 4
  - Checkbox "Petite finale (3e place)"
  - Info : "Les adversaires seront tirés au sort aléatoirement"

### 5b. App.js — Navigation

**Fichier** : `src/App.js`

Ajouter les steps `poolFinals` et wirer les nouveaux composants (PoolConfig, PoolSchedule, PoolFinals).

### 5c. Nouveau composant : PoolConfig

**Fichier** : `src/components/PoolConfig.js` + `src/styles/PoolConfig.css`

**Rôle** : Configuration et tirage par catégorie.

**UI** :

```
┌───────────────────────────────────────────────────────┐
│  CATÉGORIE : Benjamin -27kg Masculin                   │
│                                                        │
│  Combattants inscrits : 8 (pair)                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Nom          │ Club          │ Ligue             │  │
│  │ Kim Yuna     │ TKD Paris     │ Île-de-France     │  │
│  │ Park Jihye   │ TKD Lyon      │ Auvergne-RA       │  │
│  │ ...          │ ...           │ ...               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Combats par personne :  [2] [3] [4]                   │
│                          ^^^                           │
│  Total combats : 8                                     │
│                                                        │
│  [Effectuer le tirage aléatoire]                       │
│                                                        │
│  ─── Résultat du tirage ───                            │
│                                                        │
│  Kim Yuna    → vs Park Jihye, vs Lee Minho             │
│  Park Jihye  → vs Kim Yuna, vs Choi Seung              │
│  Lee Minho   → vs Kim Yuna, vs Choi Seung              │
│  Choi Seung  → vs Park Jihye, vs Lee Minho             │
│  ...                                                    │
│                                                        │
│  [Refaire le tirage]  [Valider le tirage →]            │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│  CATÉGORIE : Benjamin -30kg Masculin                   │
│  Combattants inscrits : 7 (impair)                     │
│                                                        │
│  Combats par personne :  [2] [3̶] [4]                   │
│                               ^^^ grisé               │
│  ⚠️ "3 combats impossible avec un nombre impair.       │
│     Choisissez 2 ou 4."                                │
│                                                        │
│  [Effectuer le tirage aléatoire] (désactivé)           │
└───────────────────────────────────────────────────────┘
```

**Comportement** :
1. Affiche chaque catégorie avec ses combattants
2. Sélecteur K (2/3/4) avec validation en temps réel
3. Si N impair et K=3 → message rouge + bouton désactivé
4. Bouton "Tirage" → appelle `generateKRegularDraw()` → affiche résultat
5. Bouton "Refaire" → relance le tirage
6. Bouton "Valider" → appelle `POST /api/pool/:id/draw` → passe à l'étape suivante

### 5d. Nouveau composant : PoolSchedule

**Fichier** : `src/components/PoolSchedule.js` + `src/styles/PoolSchedule.css`

**Rôle** : Affiche le planning des combats par tours.

**UI** :

```
┌───────────────────────────────────────────────────────┐
│  PLANNING - Benjamin -27kg Masculin                    │
│  8 combattants × 2 combats = 8 combats en 2 tours     │
│                                                        │
│  ── Tour 1 ──                                          │
│  Combat 1 : Kim Yuna (R) vs Park Jihye (B)    ⏳      │
│  Combat 2 : Lee Minho (R) vs Choi Seung (B)   ⏳      │
│  Combat 3 : Han Soo (R) vs Jang Mi (B)        ⏳      │
│  Combat 4 : Yoo Jin (R) vs Baek Hyun (B)      ⏳      │
│                                                        │
│  ── Tour 2 ──                                          │
│  Combat 5 : Kim Yuna (R) vs Lee Minho (B)     ⏳      │
│  Combat 6 : Park Jihye (R) vs Choi Seung (B)  ⏳      │
│  Combat 7 : Han Soo (R) vs Yoo Jin (B)        ⏳      │
│  Combat 8 : Jang Mi (R) vs Baek Hyun (B)      ⏳      │
│                                                        │
│  [← Retour]  [Saisir les scores →]                    │
└───────────────────────────────────────────────────────┘
```

**Comportement** :
1. Affiche les combats groupés par tour (issus de `organizeFightsIntoTours()`)
2. Indicateurs visuels : ⏳ en attente / 🔴 en cours / ✅ terminé
3. Navigation vers ScoreInput

### 5e. ScoreInput.js — Gamjeom + filtre phase/tour

**Fichier** : `src/components/ScoreInput.js`

Ajouts conditionnels (uniquement si `tournamentType === "poolFinals"`) :

1. **2 inputs gamjeom par round** (Rouge / Bleu) — sous chaque score de round
2. **Filtre par tour** : "Tous" | "Tour 1" | "Tour 2" | ...
3. **Filtre par phase** : "Poule" | "Demi-finales" | "Finale" | "Bronze"
4. **Classement temps réel** dans un panneau latéral (optionnel)
5. Les matchs de finale apparaissent une fois générés

**UI saisie d'un round** :
```
Round 1 :  Score Rouge [___]  Gamjeom Rouge [___]  |  Score Bleu [___]  Gamjeom Bleu [___]
Round 2 :  Score Rouge [___]  Gamjeom Rouge [___]  |  Score Bleu [___]  Gamjeom Bleu [___]
Round 3 :  Score Rouge [___]  Gamjeom Rouge [___]  |  Score Bleu [___]  Gamjeom Bleu [___]
```

### 5f. Nouveau composant : PoolFinals

**Fichier** : `src/components/PoolFinals.js` + `src/styles/PoolFinals.css`

**Rôle** : Transition poule → finales. Classement + génération + suivi.

**UI** :

```
┌──────────────────────────────────────────────────────┐
│  CLASSEMENT - Benjamin -27kg Masculin                 │
│                                                       │
│  Rang│Combattant │Club     │V│D│RW│RL│ PF│ PC│Pen    │
│  1 ⭐│Kim Yuna   │TKD Paris│2│0│ 5│ 1│ 30│  8│ 0     │
│  2 ⭐│Park Jihye │TKD Lyon │2│0│ 4│ 2│ 25│ 12│ 1     │
│  3 ⭐│Lee Minho  │TKD Mars.│1│1│ 3│ 3│ 18│ 15│ 0     │
│  4 ⭐│Choi Seung │TKD Lille│1│1│ 3│ 3│ 16│ 16│ 2     │
│  5   │Han Soo    │TKD Nice │0│2│ 1│ 5│  8│ 28│ 1     │
│  ...                                                  │
│  ⭐ = qualifié pour les finales                       │
│                                                       │
│  [Générer les finales] (actif si tous matchs finis)   │
│                                                       │
├──────────────────────────────────────────────────────┤
│  DEMI-FINALES                                         │
│  Semi 1 : Kim (1er) vs Choi (4e)    ✅ Kim gagne     │
│  Semi 2 : Park (2e) vs Lee (3e)     ✅ Park gagne    │
│                                                       │
│  FINALE                                               │
│  Kim vs Park                         ⏳ En attente    │
│                                                       │
│  PETITE FINALE                                        │
│  Choi vs Lee                         ⏳ En attente    │
│                                                       │
│  [Aller saisir les scores →]                          │
└──────────────────────────────────────────────────────┘
```

### 5g. Results.js — Podium

**Fichier** : `src/components/Results.js`

Quand `tournamentType === "poolFinals"` :
- **Podium** par catégorie : Or (gagnant finale), Argent (perdant finale), Bronze (gagnant petite finale)
- Classement complet de poule en dessous
- Export PDF/CSV avec podium + classement

---

## Phase 6 : Import CSV + Export matchs Daedo

### 6a. Import — Aucune modification nécessaire

L'import fonctionne déjà avec le format `test feyzin.csv` :

**Format existant** : séparateur `;` (point-virgule), détecté automatiquement par PapaParse

```
team;REGION;groupcategory;group;weights;lastname;firstname;gender;birthdate
TAEKWONDO CLUB FEYZIN;AURA;Minimes Masculins;Minimes Masculins -27 kg;0 - 27;MENGOUCHI;NASSIM;m;14/11/2015
```

Les colonnes (`team`, `region`, `group`, `weights`, `lastname`, `firstname`, `gender`, `birthdate`) sont **déjà mappées** dans `src/utils/csvParser.js` via le `headerMap` existant. Le parsing, la catégorisation par âge/poids et le tri fonctionnent sans aucun changement de code.

**Aucun fichier à modifier pour l'import.**

### 6b. Export — Matchs au format Daedo (après tirage)

**Fonctionnalité existante** : `src/components/ScoreInput.js:1636` — fonction `exportToCsv()`

Cette fonction exporte les matchs au format scoring Daedo avec ces colonnes :
```
MatchId,Mat,Number,Phase,Status,HomeName,HomeCountry,HomeOrgId,HomeCompetitorType,
HomeCompetitorId,AwayName,AwayCountry,AwayOrgId,AwayCompetitorType,AwayCompetitorId,
Rules,Rounds,MaxDifference,MaxPenalties,TimingRound,TimingRest,TimingInjury,
ThresholdBody,ThresholdHead,GoldenPointEnabled,GoldenPointTime,HomeOrg,AwayOrg,
Discipline,Division,Gender,WeightCategory,Role,EventID,VideoReplayHome,VideoReplayAway
```

**Réutiliser** cette même logique dans le composant `PoolSchedule.js` :
- Extraire `exportToCsv()` de ScoreInput.js vers un utilitaire partagé : `src/utils/csvExporter.js`
- Appeler cette fonction depuis PoolSchedule.js (bouton "Exporter CSV Matchs")
- Les matchs générés par le tirage sont exportés au format Daedo
- `COUNTRY` = `FRA` pour tous, `TEAMS` = nom du club

**Bouton dans PoolSchedule.js** : "Exporter CSV (format scoring)" — après validation du tirage et affichage du planning

### Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/utils/csvParser.js` | Aucune modification — import déjà fonctionnel avec format `test feyzin.csv` |
| `src/components/ScoreInput.js` | Extraire `exportToCsv()` vers utilitaire partagé |
| `src/utils/csvExporter.js` (NOUVEAU) | Fonction d'export Daedo réutilisable |
| `src/components/PoolSchedule.js` | Bouton "Exporter CSV" appelant le même format |

---

## Fichiers impactés (résumé)

### Nouveaux fichiers (7)
| Fichier | Rôle |
|---------|------|
| `src/utils/drawGenerator.js` | Validation N×K, graphe K-régulier, organisation en tours |
| `src/utils/finalsGenerator.js` | Génération matchs semi/finale/bronze |
| `src/utils/csvExporter.js` | Export matchs format Daedo (extrait de ScoreInput.js) |
| `src/components/PoolConfig.js` | Config catégorie + tirage aléatoire |
| `src/components/PoolSchedule.js` | Planning par tours + export CSV matchs |
| `src/components/PoolFinals.js` | Classement + finales + bracket |
| `src/styles/Pool*.css` (×3) | Styles pour PoolConfig, PoolSchedule, PoolFinals |

### Fichiers modifiés (13)
| Fichier | Modification |
|---------|-------------|
| `api/prisma/schema.prisma` | Champs Pool (phase, bronzeMatch, fightsPerPerson) + Match (phase, tour) + Round (penaltyA, penaltyB) |
| `api/server.js` | 3 endpoints modifiés + 4 nouveaux (phase, standings, draw, generateFinals) |
| `src/utils/resultsCalculator.js` | Nouvelle fonction `calculatePoolStandings()` |
| `src/utils/constants.js` | Mapping A/B → Rouge/Bleu |
| `src/services/dbService.js` | Modifier saveMatchResult/fetchFormattedMatches + 4 nouvelles fonctions |
| `src/components/TournamentSetup.js` | Option "Poule Unique + Finales" |
| `src/App.js` | Steps et routing pour poolFinals (8 étapes) |
| `src/components/ScoreInput.js` | Inputs gamjeom + filtres tour/phase + extraction export Daedo vers utilitaire |
| `src/components/Results.js` | Section podium |
| `spectator-app/src/types/index.ts` | Ajouter champs phase, tour, penaltyA/B, fightsPerPerson |
| `spectator-app/src/components/LiveMatches.tsx` | Afficher tour, phase, pénalités |
| `spectator-app/src/components/Results.tsx` | Classement multi-critères + bracket finales |
| `spectator-app/src/components/AllMatches.tsx` | Filtres tour/phase |

---

## Ordre d'implémentation

| # | Fichiers | Description |
|---|----------|-------------|
| **1** | `api/prisma/schema.prisma` | Migration BDD |
| **2** | `api/server.js` | Modifier endpoints + 4 nouveaux (phase, standings, draw, generateFinals) + auto-propagation |
| **3** | `src/utils/drawGenerator.js` | Validation N×K + graphe K-régulier + tours |
| **4** | `src/utils/finalsGenerator.js` | Génération matchs finales |
| **5** | `src/utils/resultsCalculator.js` | `calculatePoolStandings()` |
| **6** | `src/utils/constants.js` | Mapping Rouge/Bleu |
| **7** | `src/utils/csvExporter.js` | Extraire export Daedo de ScoreInput.js → utilitaire partagé |
| **8** | `src/services/dbService.js` | Modifier + nouvelles fonctions |
| **9** | `src/components/TournamentSetup.js` | Option "Poule Unique" |
| **10** | `src/App.js` | Steps et routing |
| **11** | `src/components/PoolConfig.js` + CSS | Config + tirage |
| **12** | `src/components/PoolSchedule.js` + CSS | Planning par tours + bouton export CSV matchs |
| **13** | `src/components/ScoreInput.js` | Gamjeom + filtres + utiliser csvExporter partagé |
| **14** | `src/components/PoolFinals.js` + CSS | Classement + finales |
| **15** | `src/components/Results.js` | Podium |
| **16** | `spectator-app/src/types/index.ts` | Types TypeScript pour nouveaux champs |
| **17** | `spectator-app/src/components/LiveMatches.tsx` | Tour, phase, pénalités |
| **18** | `spectator-app/src/components/Results.tsx` | Classement poule unique + bracket finales |
| **19** | `spectator-app/src/components/AllMatches.tsx` | Filtres tour/phase |

---

## Algorithmes clés

### 1. Validation N × K

```
validateFightsChoice(n, k):
  si (n * k) % 2 !== 0 → invalide, proposer [2, 4]
  si k >= n            → invalide (pas assez de combattants)
  sinon                → valide
```

### 2. Graphe K-régulier (tirage aléatoire)

```
generateKRegularDraw(fighterIds, k):
  Répéter (max 100 tentatives) :
    1. stubs = chaque fighter répété K fois → [A,A,B,B,C,C,D,D] pour K=2
    2. Mélanger stubs (Fisher-Yates)
    3. Former paires : (stubs[0],stubs[1]), (stubs[2],stubs[3]), ...
    4. Vérifier :
       - Pas de self-loop (A vs A)
       - Pas de multi-edge (A vs B apparaît 2 fois)
    5. Si valide → retourner les paires
  Échec après 100 tentatives → erreur
```

### 3. Organisation en tours (matching glouton)

```
organizeFightsIntoTours(fights):
  combatsRestants = [...fights]
  tours = []
  Tant que combatsRestants non vide :
    tourActuel = []
    occupés = Set()
    Pour chaque combat dans combatsRestants :
      Si fighter1 ∉ occupés ET fighter2 ∉ occupés :
        Ajouter combat à tourActuel
        occupés.add(fighter1, fighter2)
    tours.push(tourActuel)
    Retirer les combats placés de combatsRestants
  Retourner tours
```

### 4. Classement (tri multi-critères)

```
Tri par :
  1. victories DESC
  2. Si égalité entre 2 combattants qui se sont affrontés → gagnant devant
  3. roundsWon DESC
  4. totalPoints DESC
  5. penalties ASC (moins = mieux)
```

---

## Exemples concrets

### Exemple 1 : 8 combattants, 2 combats chacun
- Total combats : (8 × 2) / 2 = **8 combats**
- Tours nécessaires : **2 tours** (4 combats par tour)
- Chaque combattant combat exactement 2 fois

### Exemple 2 : 6 combattants, 3 combats chacun
- Total combats : (6 × 3) / 2 = **9 combats**
- Tours nécessaires : **3 tours** (3 combats par tour)
- Chaque combattant combat exactement 3 fois

### Exemple 3 : 7 combattants, 3 combats — IMPOSSIBLE
- (7 × 3) / 2 = 10.5 → **pas entier → erreur**
- Proposer 2 ou 4 combats à la place

### Exemple 4 : 5 combattants, 4 combats chacun
- Total combats : (5 × 4) / 2 = **10 combats** (= round-robin complet !)
- Tours nécessaires : **5 tours** (avec byes)

---

## Vérification / Tests

1. **Migration** : `npx prisma migrate dev` sans erreur, tournois existants OK
2. **Validation N×K** : tester N pair/impair avec K=2,3,4 — vérifier messages d'erreur
3. **Tirage** : vérifier que chaque combattant a exactement K adversaires différents
4. **Planning** : vérifier que chaque combattant max 1 combat par tour
5. **Scores** : vérifier gamjeom enregistrés, classement mis à jour en temps réel
6. **Classement** : vérifier la hiérarchie de départage (victoires > direct > rounds > points > pen)
7. **Finales** : vérifier génération semi1/semi2/final/bronze
8. **Auto-propagation** : saisir résultat semi → vérifier remplissage auto finale/bronze
9. **Podium** : vérifier affichage Or/Argent/Bronze
10. **Rétrocompatibilité** : tournoi "Poules" classique et "Élimination" sans régression

---

## Risques et points d'attention

| Risque | Mitigation |
|--------|-----------|
| Graphe K-régulier impossible à générer | Limite de 100 tentatives + fallback avec algo déterministe (circle method) |
| ScoreInput.js déjà 115KB | Ajout minimal (~80 lignes), conditionnel au type |
| Pool avec < 4 combattants qualifiés | Pas de demi-finales, juste une finale (top 2) |
| Auto-propagation semis → finale | Logique côté serveur (transaction Prisma) |
| K=4 avec N=5 = round-robin complet | Acceptable, l'algo de tirage dégénère en round-robin |
| Sync service (spectator view) | API retourne tous les champs automatiquement, mais composants spectator à mettre à jour |

---

## Phase 7 : Mise à jour Spectator App (Next.js)

La spectator app (`spectator-app/`) est une app Next.js séparée qui poll l'API toutes les 30s via `/api/competition/:id/matchesWithDetails`. Prisma retourne **tous les champs** donc les nouveaux champs (`phase`, `tour`, `penaltyA`, `penaltyB`, `fightsPerPerson`) seront automatiquement présents dans les réponses JSON.

### 7a. Types TypeScript

**Fichier** : `spectator-app/src/types/index.ts`

Ajouter les nouveaux champs aux interfaces existantes :

```typescript
// Match — ajouter :
phase?: string;     // 'pool' | 'semi1' | 'semi2' | 'final' | 'bronze'
tour?: number;      // numéro du tour (1, 2, 3...)

// Round — ajouter :
penaltyA?: number;  // gamjeom position A ce round
penaltyB?: number;  // gamjeom position B ce round

// Pool — ajouter :
phase?: string;          // 'config' | 'draw' | 'pool' | 'finals' | 'completed'
fightsPerPerson?: number; // 2, 3 ou 4
```

### 7b. LiveMatches — Affichage tour et phase

**Fichier** : `spectator-app/src/components/LiveMatches.tsx`

- Afficher le **numéro de tour** pour les matchs de type `poolFinals` (ex: "Tour 1 - Combat 3")
- Afficher la **phase** pour les matchs de finales (ex: "Demi-finale 1", "Finale", "Petite finale")
- Afficher les **pénalités** (gamjeom) sous les scores de rounds

### 7c. Results — Classement poule unique

**Fichier** : `spectator-app/src/components/Results.tsx`

Quand le mode est `poolFinals` :
- Afficher le classement multi-critères : V | D | RW | RL | PF | PC | Pen
- Marquer les 4 premiers qualifiés pour les finales
- Afficher le bracket des finales (semi1, semi2, finale, bronze) avec statuts live

### 7d. AllMatches — Filtres

**Fichier** : `spectator-app/src/components/AllMatches.tsx`

- Ajouter filtre par **tour** (Tour 1, Tour 2, ...)
- Ajouter filtre par **phase** (Poule, Demi-finales, Finale, Bronze)

### Fichiers impactés (spectator-app)

| Fichier | Action |
|---------|--------|
| `spectator-app/src/types/index.ts` | Ajouter champs phase, tour, penaltyA/B, fightsPerPerson |
| `spectator-app/src/components/LiveMatches.tsx` | Afficher tour, phase, pénalités |
| `spectator-app/src/components/Results.tsx` | Classement multi-critères + bracket finales |
| `spectator-app/src/components/AllMatches.tsx` | Filtres tour/phase |
