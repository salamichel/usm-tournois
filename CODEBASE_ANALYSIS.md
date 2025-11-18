# Comprehensive Codebase Analysis Report

## Executive Summary
This analysis identifies 3 major categories of issues:
1. **Redundant/Duplicate Code** patterns across controllers and services
2. **Missing/Weak TypeScript Types** where `any` types are used
3. **Common Functions** that could be extracted into shared utilities

---

## 1. REDUNDANT/DUPLICATE CODE

### 1.1 Repeated Pool and Match Loading Pattern

This pattern is repeated **3+ times** in `flexible-king.controller.ts` (lines 45-76, 430-451, 841-849, 1017-1039):

**Files Affected:**
- `/home/user/usm-tournois/server/src/controllers/flexible-king.controller.ts`
- `/home/user/usm-tournois/server/src/controllers/king.controller.ts`

**Pattern Location 1 (lines 45-76):**
```typescript
const phasesSnapshot = await flexKingDocRef.collection('phases').get();
const phases: FlexibleKingPhase[] = [];

for (const phaseDoc of phasesSnapshot.docs) {
  const phase = { id: phaseDoc.id, ...phaseDoc.data() } as FlexibleKingPhase;

  if (phase.status !== 'not_configured') {
    const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
    const pools: KingPool[] = [];
    const matches: KingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data();
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const poolMatches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() })) as KingMatch[];

      pools.push({
        id: poolDoc.id,
        name: poolData.name,
        players: poolData.players || [],
        matches: poolMatches,
        playerCount: poolData.playerCount,
        createdAt: poolData.createdAt,
      });

      matches.push(...poolMatches);
    }

    phase.pools = pools;
    phase.matches = matches;
  }

  phases.push(phase);
}
```

**Similar Pattern at Line 430-451:**
```typescript
const poolsSnapshot = await phaseDocRef.collection('pools').get();
const pools: KingPool[] = [];
const matches: KingMatch[] = [];

for (const poolDoc of poolsSnapshot.docs) {
  const poolData = poolDoc.data();
  const matchesSnapshot = await poolDoc.ref.collection('matches').get();
  const poolMatches = matchesSnapshot.docs.map((m) => ({
    id: m.id,
    ...m.data(),
  })) as KingMatch[];

  pools.push({
    id: poolDoc.id,
    name: poolData.name,
    players: poolData.players || [],
    matches: poolMatches,
    playerCount: poolData.playerCount,
  });

  matches.push(...poolMatches);
}
```

**Also at:** lines 841-849, 1017-1039

**Recommendation:** Extract to utility function `loadPoolsAndMatches()` in `/home/user/usm-tournois/server/src/utils/firestore.utils.ts`

---

### 1.2 Inconsistent Error Response Patterns

**Files Affected:**
- `/home/user/usm-tournois/server/src/controllers/flexible-king.controller.ts`
- `/home/user/usm-tournois/server/src/controllers/king.controller.ts`
- `/home/user/usm-tournois/server/src/controllers/admin.controller.ts`

**Pattern 1 - Direct res.status calls (79 instances):**
```typescript
// Line 23 in flexible-king.controller.ts
return res.status(404).json({ success: false, message: 'Tournament not found' });

// Line 270 in flexible-king.controller.ts
return res.status(404).json({ success: false, message: 'Tournament not found' });

// Line 414 in flexible-king.controller.ts
return res.status(404).json({
  success: false,
  message: `Phase ${phaseNumber} not found`,
});
```

**Pattern 2 - Using AppError (262 instances):**
```typescript
// Line 26 in match.controller.ts
throw new AppError('Tournament not found', 404);

// Line 72 in match.controller.ts
throw new AppError('You are not authorized to submit scores for this match', 403);
```

**Issue:** Controllers are using inconsistent error handling - mix of `AppError` throws and direct `res.status()` responses.

**Recommendation:** Use `AppError` consistently throughout all controllers. The `asyncHandler` middleware at line 48-51 in `/home/user/usm-tournois/server/src/middlewares/error.middleware.ts` should be used as a wrapper.

---

### 1.3 Repeated 404 Error Messages

**Same error message repeated across files:**

In `/home/user/usm-tournois/server/src/controllers/king.controller.ts`:
- Line: "Tournament not found" (appears 4+ times)
- Line: "King tournament data not found." (appears 3+ times)

In `/home/user/usm-tournois/server/src/controllers/flexible-king.controller.ts`:
- Line 23: "Tournament not found"
- Line 124: "Tournament not found"
- Line 270: "Tournament not found"

**Recommendation:** Create error message constants in a shared errors file.

---

### 1.4 Repeated Phase Existence Checks

**Pattern repeated 5+ times:**

```typescript
// Line 221 in flexible-king.controller.ts
const phaseDoc = await phaseDocRef.get();

if (!phaseDoc.exists) {
  return res.status(404).json({
    success: false,
    message: `Phase ${phaseNumber} not found`,
  });
}

// Similar at lines 276-282, 411-417, 546-552, 604-610, 661-667, 831-837, 878-884, 1001-1006
```

**Recommendation:** Create helper function `validatePhaseExists()` in utils.

---

### 1.5 Repeated Team Size and Qualified Count Distributions

**Pattern in flexible-king.service.ts and match.service.ts:**

```typescript
// Line 31-39 in flexible-king.service.ts (distributeTeamsInPools)
export function distributeTeamsInPools(totalTeams: number, numberOfPools: number): number[] {
  const baseTeamsPerPool = Math.floor(totalTeams / numberOfPools);
  const remainder = totalTeams % numberOfPools;
  const distribution: number[] = [];

  for (let i = 0; i < numberOfPools; i++) {
    distribution.push(i < remainder ? baseTeamsPerPool + 1 : baseTeamsPerPool);
  }
  return distribution;
}

// Line 46-57 (distributeQualifiedInPools) - Nearly identical
export function distributeQualifiedInPools(
  totalQualified: number,
  numberOfPools: number
): number[] {
  const baseQualifiedPerPool = Math.floor(totalQualified / numberOfPools);
  const remainder = totalQualified % numberOfPools;
  const qualifiedDistribution: number[] = [];

  for (let i = 0; i < numberOfPools; i++) {
    qualifiedDistribution.push(i < remainder ? baseQualifiedPerPool + 1 : baseQualifiedPerPool);
  }
  return qualifiedDistribution;
}
```

**Recommendation:** Create generic `distributeItemsAcrossGroups(total: number, groups: number)` function.

---

## 2. MISSING/WEAK TYPESCRIPT TYPES

### 2.1 `any` Type Usage in Tournament Status Utility

**File:** `/home/user/usm-tournois/server/src/utils/tournament.status.utils.ts`

**Line 15:**
```typescript
export const calculateTournamentStatus = (
  tournament: any,  // ❌ Should be: Tournament
  completeTeamsCount: number,
  totalTeamsCount: number
): TournamentStatusResult => {
```

**Recommendation:** Import and use `Tournament` type from `@shared/types`:
```typescript
import type { Tournament, TournamentStatus } from '@shared/types';

export const calculateTournamentStatus = (
  tournament: Tournament,
  completeTeamsCount: number,
  totalTeamsCount: number
): TournamentStatusResult => {
```

---

### 2.2 `any` Type in Match Service

**File:** `/home/user/usm-tournois/server/src/services/match.service.ts`

Multiple instances of `any` type that should be properly typed:

**Line 93-94:**
```typescript
export async function calculatePoolRanking(
  tournamentId: string,
  poolId: string,
  teamsInPool: any[],  // ❌ Should be: Team[]
  matches: any[]       // ❌ Should be: Match[]
): Promise<TeamStanding[]> {
```

**Line 192-193:**
```typescript
interface EliminationTeamStats {
  team: any;  // ❌ Should be: Team
  matchesPlayed: number;
  ...
}
```

**Line 207:**
```typescript
export function calculateEliminationRanking(eliminationMatches: any[]): [string, EliminationTeamStats][] {  // ❌ Should be: Match[]
```

**Line 405-410:**
```typescript
export async function updateMatchScoresAndStatus(
  matchRef: any,           // ❌ Should be: FirebaseFirestore.DocumentReference
  currentMatch: any,       // ❌ Should be: KingMatch | Match
  submittedSets: any[],    // ❌ Should be: MatchSet[]
  tournamentData: any,     // ❌ Should be: Tournament
  matchType: 'pool' | 'elimination',
  batch: any | null = null // ❌ Should be: FirebaseFirestore.WriteBatch | null
): Promise<CompleteMatchResult> {
```

**Line 486-492:**
```typescript
export async function propagateEliminationMatchResults(
  tournamentId: string,
  currentMatch: any,  // ❌ Should be: EliminationMatch
  winnerId: string,
  winnerName: string,
  loserId: string,
  loserName: string,
  batch: any          // ❌ Should be: FirebaseFirestore.WriteBatch
): Promise<void> {
```

---

### 2.3 `any` Type in Firebase Config

**File:** `/home/user/usm-tournois/server/src/config/firebase.config.ts`

**Line 11:**
```typescript
let serviceAccount: any;  // ❌ Should be: ServiceAccount or Firebase's credential type
```

**Recommendation:** Define proper type:
```typescript
import type { ServiceAccount } from 'firebase-admin/app';

let serviceAccount: ServiceAccount;
```

---

### 2.4 `any` Type in Flexible King Service

**File:** `/home/user/usm-tournois/server/src/services/flexible-king.service.ts`

**Line 413:**
```typescript
function generateRoundRobinMatches(
  poolPlayers: KingPlayer[],
  poolId: string,
  _poolName: string,
  teamSize: number,
  teamsPerPool: number,
  numRounds: number,
  phaseNumber: number
): KingMatch[] {
  const matches: KingMatch[] = [];
  let matchNumberInPool = 1;

  for (let roundNum = 1; roundNum <= numRounds; roundNum++) {
    const roundId = `round-${poolId}-${roundNum}`;
    const roundName = `Phase ${phaseNumber} - Tournée ${roundNum}`;

    const shuffledPoolPlayers = shuffleArray([...poolPlayers]);
    const teams = formRandomTeams(shuffledPoolPlayers, teamSize, teamsPerPool);

    // Round Robin: all combinations (C(N,2))
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `match-${poolId}-${matchNumberInPool}`,
          matchNumber: matchNumberInPool,
          team1: teams[i],
          team2: teams[j],
          format: `${teamSize}v${teamSize}` as any,  // ❌ Should be: PhaseFormat or KingFormat
          status: 'pending',
          roundId: roundId,
          roundName: roundName,
          poolId: poolId,
          createdAt: new Date(),
        });
        matchNumberInPool++;
      }
    }
  }

  return matches;
}
```

**Line 457 & 774 in flexible-king.controller.ts:**
```typescript
const teams = formRandomTeams(shuffledPlayers, teamSize, teamsPerPool);

matches.push({
  // ...
  format: `${teamSize}v${teamSize}` as any,  // ❌ Should be properly typed
  // ...
});

// And in controller:
winnerPlayerIds: winnerTeam ? winnerTeam.members.map((m: any) => m.id) : [],  // ❌ m should be: KingPlayer
```

---

### 2.5 Missing Return Types

**File:** `/home/user/usm-tournois/server/src/controllers/flexible-king.controller.ts`

All controller functions are missing return type annotations:

```typescript
// Line 16 - Missing return type
export const getFlexibleKingDashboard = async (req: Request, res: Response) => {
  // ❌ Should be: export const getFlexibleKingDashboard = async (req: Request, res: Response): Promise<void> => {

// Line 108
export const initializeFlexibleKing = async (req: Request, res: Response) => {
  // ❌ Should include: Promise<void>
```

---

### 2.6 Tournament Service Missing Parameter Types

**File:** `/home/user/usm-tournois/server/src/services/king.service.ts`

**Line 50:**
```typescript
const updateData: any = {  // ❌ Should be a specific interface
  isKingPhaseCompleted: isPhaseCompleted,
  updatedAt: new Date(),
};
```

---

## 3. COMMON FUNCTIONS TO EXTRACT

### 3.1 Firestore Document Existence Helper

**Currently repeated 96 times across controllers:**

```typescript
// Current pattern (repeated)
const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
if (!tournamentDoc.exists) {
  return res.status(404).json({ success: false, message: 'Tournament not found' });
}
```

**Recommendation - Create in `/home/user/usm-tournois/server/src/utils/firestore.utils.ts`:**

```typescript
export async function getDocumentOrThrow(
  ref: FirebaseFirestore.DocumentReference,
  errorMessage: string = 'Document not found',
  statusCode: number = 404
): Promise<FirebaseFirestore.DocumentSnapshot> {
  const doc = await ref.get();
  if (!doc.exists) {
    throw new AppError(errorMessage, statusCode);
  }
  return doc;
}

// Usage:
const tournamentDoc = await getDocumentOrThrow(
  adminDb.collection('events').doc(tournamentId),
  'Tournament not found'
);
```

---

### 3.2 Pool and Match Loading Utility

**Used 3+ times in flexible-king and king controllers:**

**Create in `/home/user/usm-tournois/server/src/utils/firestore.utils.ts`:**

```typescript
export async function loadPhasePoolsAndMatches(
  phaseDocRef: FirebaseFirestore.DocumentReference
): Promise<{ pools: KingPool[]; matches: KingMatch[] }> {
  const poolsSnapshot = await phaseDocRef.collection('pools').get();
  const pools: KingPool[] = [];
  const matches: KingMatch[] = [];

  for (const poolDoc of poolsSnapshot.docs) {
    const poolData = poolDoc.data();
    const matchesSnapshot = await poolDoc.ref.collection('matches').get();
    const poolMatches = matchesSnapshot.docs.map((m) => ({
      id: m.id,
      ...m.data(),
    })) as KingMatch[];

    pools.push({
      id: poolDoc.id,
      name: poolData.name,
      players: poolData.players || [],
      matches: poolMatches,
      playerCount: poolData.playerCount,
      createdAt: poolData.createdAt,
    });

    matches.push(...poolMatches);
  }

  return { pools, matches };
}

// Usage in controllers:
const { pools, matches } = await loadPhasePoolsAndMatches(phaseDocRef);
```

**Affected files:**
- `/home/user/usm-tournois/server/src/controllers/flexible-king.controller.ts` (lines 45-76, 430-451, 841-849, 1017-1039)
- `/home/user/usm-tournois/server/src/controllers/king.controller.ts` (lines 111-147, similar patterns)

---

### 3.3 Array Distribution Utility

**Pattern in flexible-king.service.ts lines 31-39 and 46-57:**

**Create generic utility in `/home/user/usm-tournois/server/src/utils/array.utils.ts`:**

```typescript
/**
 * Distributes total items evenly across groups
 * Example: distribute(10, 3) → [4, 3, 3]
 */
export function distributeItemsAcrossGroups(total: number, groups: number): number[] {
  const basePerGroup = Math.floor(total / groups);
  const remainder = total % groups;
  const distribution: number[] = [];

  for (let i = 0; i < groups; i++) {
    distribution.push(i < remainder ? basePerGroup + 1 : basePerGroup);
  }
  return distribution;
}

// Replace in flexible-king.service.ts:
export function distributeTeamsInPools(totalTeams: number, numberOfPools: number): number[] {
  return distributeItemsAcrossGroups(totalTeams, numberOfPools);
}

export function distributeQualifiedInPools(totalQualified: number, numberOfPools: number): number[] {
  return distributeItemsAcrossGroups(totalQualified, numberOfPools);
}
```

---

### 3.4 Batch Update Pattern

**Pattern used 37 times across controllers:**

**Create in `/home/user/usm-tournois/server/src/utils/firestore.utils.ts`:**

```typescript
export async function batchUpdateAndCommit(
  updates: Array<{
    ref: FirebaseFirestore.DocumentReference;
    data: Record<string, any>;
  }>
): Promise<void> {
  const batch = adminDb.batch();
  
  for (const { ref, data } of updates) {
    batch.update(ref, data);
  }
  
  await batch.commit();
}

// Usage:
await batchUpdateAndCommit([
  {
    ref: phaseDocRef,
    data: { status: 'completed', updatedAt: new Date() }
  },
  {
    ref: flexKingDocRef,
    data: { updatedAt: new Date() }
  }
]);
```

---

### 3.5 Validation and Error Response Helper

**Pattern repeated in multiple controllers:**

```typescript
// Current pattern (repeated multiple times)
if (!Array.isArray(withdrawnPlayerIds)) {
  return res.status(400).json({
    success: false,
    message: 'withdrawnPlayerIds must be an array',
  });
}

// And similar patterns
if (!config) {
  return res.status(400).json({
    success: false,
    message: 'Phase configuration is required',
  });
}
```

**Create in `/home/user/usm-tournois/server/src/utils/validation.utils.ts`:**

```typescript
import { AppError } from '../middlewares/error.middleware';

export function validateIsArray(value: any, fieldName: string): void {
  if (!Array.isArray(value)) {
    throw new AppError(`${fieldName} must be an array`, 400);
  }
}

export function validateRequired(value: any, fieldName: string): void {
  if (!value) {
    throw new AppError(`${fieldName} is required`, 400);
  }
}

export function validateIsString(value: any, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} must be a string`, 400);
  }
}

// Usage:
validateIsArray(withdrawnPlayerIds, 'withdrawnPlayerIds');
validateRequired(config, 'Phase configuration');
```

---

### 3.6 Phase Validation Helpers

**Pattern in flexible-king.controller.ts:**

```typescript
// Line 422-427
if (phase.status !== 'in_progress') {
  return res.status(400).json({
    success: false,
    message: `Phase ${phaseNumber} is not in progress`,
  });
}

// Similar patterns at other locations
if (phase.status !== 'completed') {
  return res.status(400).json({
    success: false,
    message: `Phase ${phaseNumber} must be completed to get repechage candidates`,
  });
}
```

**Create in `/home/user/usm-tournois/server/src/utils/validation.utils.ts`:**

```typescript
export function validatePhaseStatus(
  phase: FlexibleKingPhase,
  expectedStatus: FlexiblePhaseStatus,
  phaseNumber: number
): void {
  if (phase.status !== expectedStatus) {
    throw new AppError(
      `Phase ${phaseNumber} must be ${expectedStatus}, but is ${phase.status}`,
      400
    );
  }
}

// Usage:
validatePhaseStatus(phase, 'in_progress', phaseNumber);
validatePhaseStatus(phase, 'completed', phaseNumber);
```

---

### 3.7 Error Message Constants

**Create in `/home/user/usm-tournois/server/src/constants/error.messages.ts`:**

```typescript
export const ERROR_MESSAGES = {
  TOURNAMENT_NOT_FOUND: 'Tournament not found',
  TOURNAMENT_NOT_FOUND_IN_REQUEST: 'Tournament not found in request',
  KING_DATA_NOT_FOUND: 'King tournament data not found',
  PHASE_NOT_FOUND: (phaseNumber: number) => `Phase ${phaseNumber} not found`,
  PHASE_NOT_IN_PROGRESS: (phaseNumber: number) => `Phase ${phaseNumber} is not in progress`,
  PHASE_NOT_COMPLETED: (phaseNumber: number) => `Phase ${phaseNumber} must be completed first`,
  MATCH_NOT_FOUND: 'Match not found',
  MATCH_NOT_FOUND_IN_PHASE: 'Match not found in this phase',
  POOL_NOT_FOUND: 'Pool not found',
  UNASSIGNED_PLAYERS_NOT_FOUND: 'Unassigned players not found',
};

// Usage in controllers:
if (!tournamentDoc.exists) {
  throw new AppError(ERROR_MESSAGES.TOURNAMENT_NOT_FOUND, 404);
}

if (!phaseDoc.exists) {
  throw new AppError(ERROR_MESSAGES.PHASE_NOT_FOUND(phaseNumber), 404);
}
```

---

## 4. SUMMARY TABLE

| Issue Category | Files | Count | Severity | Effort |
|---|---|---|---|---|
| Pool/Match Loading Pattern | flexible-king, king controllers | 4 instances | Medium | Low |
| Inconsistent Error Handling | All controllers | 79 direct calls vs 262 AppError | High | Medium |
| Repeated Error Messages | Multiple controllers | 10+ messages | Low | Low |
| `any` Type Usage | Services, Config, Controllers | 30+ instances | High | Medium |
| Missing Return Type Annotations | Controllers | All async functions | Medium | Low |
| Repeated Validation Logic | Controllers | 15+ patterns | Medium | Low |
| Repeated Distribution Algorithm | Services | 2 identical functions | Low | Low |
| Batch Operations | Controllers | 37 instances | Medium | Low |

---

## 5. RECOMMENDED IMPLEMENTATION PRIORITY

### Phase 1: High Impact, Low Effort
1. Create error message constants
2. Add return type annotations to controller functions
3. Extract pool/match loading utility

### Phase 2: High Impact, Medium Effort
1. Make error handling consistent (all AppError)
2. Fix TypeScript types in services (match.service.ts)
3. Create validation helper functions

### Phase 3: Medium Impact, Medium Effort
1. Extract batch update utility
2. Extract array distribution utility
3. Add proper types for Firebase config

---

## 6. CHECKLIST FOR IMPLEMENTATION

- [ ] Create `/home/user/usm-tournois/server/src/utils/array.utils.ts` with `distributeItemsAcrossGroups()`
- [ ] Create `/home/user/usm-tournois/server/src/utils/validation.utils.ts` with validation helpers
- [ ] Create `/home/user/usm-tournois/server/src/constants/error.messages.ts` with error constants
- [ ] Update `/home/user/usm-tournois/server/src/utils/firestore.utils.ts` with new utilities
- [ ] Update all controllers to use consistent error handling with `AppError`
- [ ] Add return type `Promise<void>` to all async controller functions
- [ ] Replace `any` types in `/home/user/usm-tournois/server/src/services/match.service.ts`
- [ ] Update `/home/user/usm-tournois/server/src/utils/tournament.status.utils.ts` to use `Tournament` type
- [ ] Update `/home/user/usm-tournois/server/src/config/firebase.config.ts` to use proper types
- [ ] Replace pool/match loading pattern with utility function in controllers

