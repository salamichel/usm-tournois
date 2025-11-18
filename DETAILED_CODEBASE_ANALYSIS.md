# CODEBASE ANALYSIS REPORT
## Code Redundancy, Missing TypeScript Types, and Refactoring Opportunities

**Analysis Date:** November 18, 2025
**Codebase Size:** ~12,785 lines of TypeScript in server/src

---

## SECTION 1: REDUNDANT/DUPLICATE CODE

### 1.1 REPEATED FIRESTORE PATH PATTERNS

**Issue:** The same Firestore collection path is repeated 50+ times across the codebase.

**Pattern Found:**
```typescript
adminDb.collection('events').doc(tournamentId).collection('teams')
adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers')
adminDb.collection('events').doc(tournamentId).collection('pools')
```

**Files Affected:**
- `/server/src/controllers/tournament.controller.ts` (Lines 15-29, 117-180)
- `/server/src/controllers/admin.controller.ts` (Lines 19-23, 290-305, 723-784)
- `/server/src/controllers/team.controller.ts` (Lines 18-23, 59-69, 120-180)
- `/server/src/controllers/match.controller.ts` (Lines 37-49)

**Occurrence Count:** 57+ occurrences across 8 controller files

**Suggested Fix:** Create utility functions in `/server/src/utils/firestore.utils.ts`:
```typescript
export const getTournamentTeamsRef = (tournamentId: string) =>
  adminDb.collection('events').doc(tournamentId).collection('teams');

export const getUnassignedPlayersRef = (tournamentId: string) =>
  adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers');

export const getPoolsRef = (tournamentId: string) =>
  adminDb.collection('events').doc(tournamentId).collection('pools');
```

---

### 1.2 DUPLICATE TOURNAMENT EXISTENCE CHECK

**Pattern:** Tournament validation repeated in multiple functions without abstraction.

**Locations:**
- `tournament.controller.ts:225-228` - registerPlayer function
- `tournament.controller.ts:281-284` - registerTeam function
- `tournament.controller.ts:464-467` - joinTeam function
- `admin.controller.ts:515-518` - generatePoolMatches function
- `admin.controller.ts:647-650` - generateEliminationBracket function

**Code Duplication:**
```typescript
// REPEATED IN 5+ PLACES
const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
if (!tournamentDoc.exists) {
  throw new AppError('Tournament not found', 404);
}
const tournament = tournamentDoc.data();
```

**Suggested Solution:** Create utility in `/server/src/utils/validation.utils.ts`:
```typescript
export async function validateTournamentExists(tournamentId: string) {
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  return tournamentDoc.data();
}
```

---

### 1.3 DUPLICATE TEAM MEMBER MANAGEMENT LOGIC

**Pattern:** Adding/removing members from teams repeated across multiple functions.

**Locations:**
1. `tournament.controller.ts:507-528` - joinTeam function
2. `tournament.controller.ts:598-611` - leaveTeam function
3. `tournament.controller.ts:686-696` - createTeam function
4. `team.controller.ts:171-193` - addMember function

**Duplicate Code:**
```typescript
// PATTERN 1: Remove from unassignedPlayers
const unassignedPlayerRef = adminDb
  .collection('events')
  .doc(tournamentId)
  .collection('unassignedPlayers')
  .doc(userId);

const unassignedDoc = await unassignedPlayerRef.get();
if (unassignedDoc.exists) {
  batch.delete(unassignedPlayerRef);
}
```

**Duplicate Code Pattern 2:**
```typescript
// REPEATED: Add member with pseudo/level defaults
batch.update(teamRef, {
  members: [
    ...currentMembers,
    {
      userId: userId,
      pseudo: userData?.pseudo || 'Unknown',
      level: userData?.level || 'N/A',
    },
  ],
});
```

**Suggested Solution:** Create service function `/server/src/services/team.service.ts`:
```typescript
export async function removePlayerFromUnassignedList(
  tournamentId: string,
  userId: string,
  batch?: any
) {
  const unassignedRef = adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('unassignedPlayers')
    .doc(userId);

  const unassignedDoc = await unassignedRef.get();
  if (unassignedDoc.exists) {
    if (batch) {
      batch.delete(unassignedRef);
    } else {
      await unassignedRef.delete();
    }
    return true;
  }
  return false;
}
```

---

### 1.4 DUPLICATE SCORE CALCULATION LOGIC

**Pattern:** Match score calculation duplicated in controller and service.

**Location 1:** `/server/src/controllers/match.controller.ts:75-104`
```typescript
let setsWonTeam1 = 0;
let setsWonTeam2 = 0;

sets.forEach((set: any) => {
  if (set.score1 > set.score2) {
    setsWonTeam1++;
  } else if (set.score2 > set.score1) {
    setsWonTeam2++;
  }
});

let matchStatus = 'in_progress';
let winnerId = null;
let loserId = null;

if (setsWonTeam1 >= setsToWin || setsWonTeam2 >= setsToWin) {
  matchStatus = 'completed';
  if (setsWonTeam1 > setsWonTeam2) {
    winnerId = matchData.team1.id;
    loserId = matchData.team2?.id || null;
  } else {
    winnerId = matchData.team2?.id || null;
    loserId = matchData.team1.id;
  }
}
```

**Location 2:** `/server/src/services/match.service.ts:52-81`
```typescript
// Similar logic but with different structure
export function calculateMatchOutcome(
  sets: MatchSet[],
  setsToWin: number,
  pointsPerSet: number,
  tieBreakEnabled: boolean
): MatchOutcome {
  // ...
}
```

**Issue:** The service has the proper implementation but match.controller.ts has its own inline version.

---

### 1.5 DUPLICATE POOL/RANKING CALCULATION

**Location 1:** `admin.controller.ts:685-730` - Inline ranking calculation
```typescript
const teamStats: any = {};
poolTeams.forEach((team: any) => {
  teamStats[team.id] = {
    id: team.id,
    name: team.name,
    poolName: poolData.name,
    wins: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
  };
});

matches.forEach((match: any) => {
  if (match.status === 'completed') {
    // ... complex ranking logic
  }
});
```

**Location 2:** `match.service.ts:90-185` - calculatePoolRanking function
```typescript
export async function calculatePoolRanking(
  tournamentId: string,
  poolId: string,
  teamsInPool: any[],
  matches: any[]
): Promise<TeamStanding[]> {
  // ... same logic
}
```

**Issue:** Admin controller duplicates the pool ranking logic instead of using the service function.

---

### 1.6 DUPLICATE ERROR HANDLING FOR NOT-FOUND ERRORS

**Pattern:** 57 instances of checking if a document exists

**Sample Locations:**
- `tournament.controller.ts:112-114` - getTournamentById
- `tournament.controller.ts:226-228` - registerPlayer
- `tournament.controller.ts:281-284` - registerTeam
- `admin.controller.ts:1125-1127` - deleteTeam
- Multiple other locations...

**Code:**
```typescript
const teamDoc = await teamRef.get();
if (!teamDoc.exists) {
  throw new AppError('Team not found', 404);
}
```

---

### 1.7 DUPLICATE TEAM CAPTAIN VERIFICATION

**Pattern:** Repeated across multiple functions

**Locations:**
- `tournament.controller.ts:370` - unregisterTeam
- `tournament.controller.ts:577` - leaveTeam
- `team.controller.ts:74` - updateTeamSettings
- `team.controller.ts:136` - addMember

**Code:**
```typescript
const teamData = teamDoc.data();
if (teamData?.captainId !== userId) {
  throw new AppError('You are not the captain of this team', 403);
  // OR
  throw new AppError('Access denied. You are not the captain of this team', 403);
}
```

**Issue:** Same logic with slightly different error messages

---

### 1.8 DUPLICATE UNASSIGNED PLAYER PROCESSING

**Pattern:** Getting unassigned player data and mapping it

**Locations:**
- `tournament.controller.ts:125-139`
- `admin.controller.ts:152-165`
- `admin.controller.ts:1305-1316`

**Code:**
```typescript
const unassignedPlayersSnapshot = await adminDb
  .collection('events')
  .doc(id)
  .collection('unassignedPlayers')
  .get();

const unassignedPlayers = unassignedPlayersSnapshot.docs.map((doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId || doc.id,
    pseudo: data.pseudo || 'Unknown',
    level: data.level || 'N/A',
    ...data,
  };
});
```

---

## SECTION 2: MISSING TYPESCRIPT TYPES

### 2.1 EXCESSIVE USE OF `any` TYPE

**Critical Files with `any` Usage:**

**1. `/server/src/controllers/tournament.controller.ts`**
- Line 22: `const tournamentData: any = doc.data();`
- Line 49: `const result: any = { ... }`
- Line 63: `const members = teamData.members || []; const isInTeam = members.some((m: any) => m.userId === userId);`
- Line 91: `const result: any = { ... }`
- Line 135: `const userData: any = { ... }`
- Line 222: `const updateData: any = { ... }`
- Line 287: `let foundTeamData: any = null;`

**Total `any` count:** 20+ instances in this file alone

**2. `/server/src/controllers/admin.controller.ts`**
- Line 16: `const data = doc.data();`
- Line 91: `const tournamentData: any = { ... }`
- Line 135: `catch (error: any)`
- Line 177: `catch (error: any)`
- Line 222: `const updateData: any = { ... }`
- Line 685: `const teamStats: any = {};`
- Line 945: `finalRanking.forEach((teamEntry: any, index: number) => {`

**Total `any` count:** 30+ instances

**3. `/server/src/controllers/match.controller.ts`**
- Line 7: `const { sets, matchType, poolId } = req.body;`
- Line 57: `const matchData = matchDoc.data();`
- Line 83: `sets.forEach((set: any) => {`

**4. `/server/src/controllers/team.controller.ts`**
- Line 79: `const updateData: any = { ... }`
- Line 156: `const alreadyInTeam = currentMembers.some((m: any) => m.userId === memberId);`

---

### 2.2 MISSING RETURN TYPES ON ASYNC CONTROLLER FUNCTIONS

**Issue:** All controller functions missing explicit return type (implicitly `Promise<void>`)

**Examples:**
```typescript
// /server/src/controllers/tournament.controller.ts:11
export const getAllTournaments = async (req: Request, res: Response) => {
  // Missing: : Promise<void>
  try {
    // ...
    res.json({ success: true, data: { tournaments } });
  }
}

// /server/src/controllers/tournament.controller.ts:215
export const registerPlayer = async (req: Request, res: Response) => {
  // Missing: : Promise<void>
  try {
    // ...
  }
}
```

**Affected Functions:** All 40+ controller functions lack return type annotations

**Suggested Fix:**
```typescript
export const getAllTournaments = async (req: Request, res: Response): Promise<void> => {
  // ...
}
```

---

### 2.3 UNTYPED MIDDLEWARE PARAMETERS

**Location:** `/server/src/controllers/tournament.controller.ts:217, 351, 398, etc.`

```typescript
const userId = (req as any).user?.uid;
// Should be properly typed middleware that extends Request
```

**Better approach:** Create typed Request interface:
```typescript
interface AuthenticatedRequest extends Request {
  user?: { uid: string; email: string };
}

const userId = (req as AuthenticatedRequest).user?.uid;
```

---

### 2.4 MISSING FUNCTION PARAMETER TYPES

**Location:** `/server/src/services/king.service.ts:89-105`

```typescript
export function formRandomTeams(
  playersInPool: KingPlayer[],
  teamSize: number,        // MISSING: Should enforce integer
  numberOfTeams: number    // MISSING: Should enforce integer
): KingTeam[] {
  // ...
}
```

**Location:** `/server/src/controllers/admin.controller.ts:1651`

```typescript
const players = unassignedPlayersSnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data(),  // MISSING: No type for doc.data()
}));
```

---

### 2.5 MISSING INTERFACE DEFINITIONS FOR COMMON PATTERNS

**Pattern 1: Update Data Objects**
```typescript
// Used 20+ times but never properly typed
const updateData: any = {
  updatedAt: new Date(),
};

if (name !== undefined && name !== null) updateData.name = name;
if (level !== undefined && level !== null) updateData.level = level;
```

**Pattern 2: Batch Operations**
```typescript
// Used frequently but not typed
const batch = adminDb.batch();
// ... no type information about what batch contains
```

---

### 2.6 MISSING RETURN TYPE ON SERVICE FUNCTIONS

**Location:** `/server/src/services/match.service.ts:52`

```typescript
export function calculateMatchOutcome(
  sets: MatchSet[],
  setsToWin: number,
  pointsPerSet: number,
  tieBreakEnabled: boolean
): MatchOutcome {  // ✓ Has return type - GOOD
  // ...
}
```

**Counter-example in match.controller.ts:75**
```typescript
// Manual inline calculation without service - harder to type
let setsWonTeam1 = 0;  // MISSING: Type annotation
let setsWonTeam2 = 0;  // MISSING: Type annotation
```

---

### 2.7 UNTYPED QUERY RESULTS

**Location:** `/server/src/controllers/tournament.controller.ts:178-191`

```typescript
const finalRankingSnapshot = await adminDb
  .collection('events')
  .doc(id)
  .collection('finalRanking')
  .orderBy('rank')
  .get();

const finalRanking = finalRankingSnapshot.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),  // Type is 'any'
}));
```

---

## SECTION 3: OPPORTUNITIES FOR EXTRACTING COMMON FUNCTIONS

### 3.1 CREATE FIRESTORE QUERY UTILITIES

**File:** `/server/src/utils/firestore-query.utils.ts` (NEW)

```typescript
// Firestore collection reference utilities
export const Collections = {
  events: () => adminDb.collection('events'),
  users: () => adminDb.collection('users'),
  getTournamentTeams: (tournamentId: string) =>
    adminDb.collection('events').doc(tournamentId).collection('teams'),
  getTournamentPools: (tournamentId: string) =>
    adminDb.collection('events').doc(tournamentId).collection('pools'),
  getTournamentMatches: (tournamentId: string, poolId: string) =>
    adminDb.collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId)
      .collection('matches'),
  getTournamentUnassignedPlayers: (tournamentId: string) =>
    adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers'),
  getTournamentEliminationMatches: (tournamentId: string) =>
    adminDb.collection('events').doc(tournamentId).collection('eliminationMatches'),
};
```

---

### 3.2 CREATE VALIDATION UTILITIES

**File:** `/server/src/utils/validation.utils.ts` (NEW)

```typescript
export async function validateTournamentExists(tournamentId: string) {
  const doc = await adminDb.collection('events').doc(tournamentId).get();
  if (!doc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  return doc.data();
}

export async function validateTeamExists(tournamentId: string, teamId: string) {
  const doc = await Collections.getTournamentTeams(tournamentId).doc(teamId).get();
  if (!doc.exists) {
    throw new AppError('Team not found', 404);
  }
  return doc.data();
}

export async function validateTeamCaptain(
  teamData: any,
  userId: string,
  errorMessage: string = 'You are not the captain of this team'
) {
  if (teamData?.captainId !== userId) {
    throw new AppError(errorMessage, 403);
  }
}

export async function validateUserExists(userId: string) {
  const doc = await adminDb.collection('users').doc(userId).get();
  if (!doc.exists) {
    throw new AppError('User not found', 404);
  }
  return doc.data();
}

export async function validateUserAuthenticated(userId?: string) {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }
  return userId;
}
```

---

### 3.3 CREATE MEMBER MANAGEMENT SERVICE

**File:** `/server/src/services/member.service.ts` (NEW)

```typescript
export interface MemberData {
  userId: string;
  pseudo: string;
  level: string;
}

export async function addMemberToTeam(
  teamRef: any,
  currentMembers: any[],
  newMemberId: string,
  userData: any,
  batch?: any
): Promise<void> {
  const memberData: MemberData = {
    userId: newMemberId,
    pseudo: userData?.pseudo || 'Unknown',
    level: userData?.level || 'N/A',
  };

  const updateData = {
    members: [...currentMembers, memberData],
    updatedAt: new Date(),
  };

  if (batch) {
    batch.update(teamRef, updateData);
  } else {
    await teamRef.update(updateData);
  }
}

export async function removeMemberFromTeam(
  teamRef: any,
  currentMembers: any[],
  memberId: string,
  batch?: any
): Promise<void> {
  const updatedMembers = currentMembers.filter((m: any) => m.userId !== memberId);
  
  if (batch) {
    batch.update(teamRef, { members: updatedMembers, updatedAt: new Date() });
  } else {
    await teamRef.update({ members: updatedMembers, updatedAt: new Date() });
  }
}

export async function removePlayerFromUnassignedList(
  tournamentId: string,
  userId: string,
  batch?: any
): Promise<boolean> {
  const unassignedRef = Collections.getTournamentUnassignedPlayers(tournamentId).doc(userId);
  const doc = await unassignedRef.get();
  
  if (doc.exists) {
    if (batch) {
      batch.delete(unassignedRef);
    } else {
      await unassignedRef.delete();
    }
    return true;
  }
  return false;
}
```

---

### 3.4 STANDARDIZE ERROR RESPONSES

**File:** `/server/src/utils/response.utils.ts` (NEW)

```typescript
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message: string, code?: string) {
  return {
    success: false,
    message,
    code,
  };
}

export function notFoundError(entityName: string) {
  throw new AppError(`${entityName} not found`, 404);
}

export function unauthorizedError(message: string = 'User not authenticated') {
  throw new AppError(message, 401);
}

export function forbiddenError(message: string = 'Access denied') {
  throw new AppError(message, 403);
}

export function validationError(message: string) {
  throw new AppError(message, 400);
}
```

---

### 3.5 EXTRACT MATCH UTILITIES

**File:** `/server/src/services/match-utils.service.ts` (NEW)

```typescript
export async function getMatchAndValidate(
  matchRef: any,
  matchType: 'pool' | 'elimination'
) {
  const matchDoc = await matchRef.get();
  if (!matchDoc.exists) {
    throw new AppError(`${matchType} match not found`, 404);
  }
  return { matchDoc, matchData: matchDoc.data() };
}

export function calculateSetsWon(sets: any[]): { setsWonTeam1: number; setsWonTeam2: number } {
  let setsWonTeam1 = 0;
  let setsWonTeam2 = 0;

  sets.forEach((set) => {
    if (set.score1 > set.score2) {
      setsWonTeam1++;
    } else if (set.score2 > set.score1) {
      setsWonTeam2++;
    }
  });

  return { setsWonTeam1, setsWonTeam2 };
}

export function determineMatchWinner(
  team1Id: string,
  team2Id: string,
  setsWonTeam1: number,
  setsWonTeam2: number
) {
  if (setsWonTeam1 > setsWonTeam2) {
    return { winnerId: team1Id, loserId: team2Id };
  } else {
    return { winnerId: team2Id, loserId: team1Id };
  }
}
```

---

### 3.6 CREATE POOL MANAGEMENT SERVICE

**File:** `/server/src/services/pool.service.ts` (ENHANCE)

**Currently has:** `calculatePoolRanking`, `calculateEliminationRanking`

**Should add:**
```typescript
export async function getPoolTeams(
  tournamentId: string,
  poolId: string
): Promise<any[]> {
  const poolDoc = await Collections.getTournamentPools(tournamentId).doc(poolId).get();
  if (!poolDoc.exists) {
    throw new AppError('Pool not found', 404);
  }
  return poolDoc.data()?.teams || [];
}

export async function getPoolMatches(
  tournamentId: string,
  poolId: string
): Promise<any[]> {
  const matchesSnapshot = await Collections
    .getTournamentMatches(tournamentId, poolId)
    .orderBy('matchNumber')
    .get();
  return matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

---

### 3.7 BATCH OPERATION UTILITIES

**File:** `/server/src/utils/batch.utils.ts` (NEW)

```typescript
export function createBatch() {
  return adminDb.batch();
}

export async function deleteCollectionDocuments(
  collectionRef: any,
  batch: any
): Promise<number> {
  const snapshot = await collectionRef.get();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  return snapshot.size;
}

export async function deleteSubcollectionDocuments(
  parentRef: any,
  subcollectionName: string,
  batch: any
): Promise<number> {
  let count = 0;
  const docsSnapshot = await parentRef.collection(subcollectionName).get();
  docsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });
  return count;
}
```

---

### 3.8 PLAYER MANAGEMENT SERVICE

**File:** `/server/src/services/player.service.ts` (NEW)

```typescript
export async function getPlayerData(userId: string): Promise<any> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new AppError('User not found', 404);
  }
  return userDoc.data();
}

export function formatPlayerData(userData: any) {
  return {
    userId: userData.uid,
    pseudo: userData?.pseudo || 'Unknown',
    level: userData?.level || 'N/A',
  };
}

export async function getPlayerRegistrationStatus(
  userId: string,
  tournamentId: string
): Promise<{ isRegistered: boolean; type: 'team' | 'unassigned' | null; teamName?: string }> {
  // Check teams
  const teamsSnapshot = await Collections.getTournamentTeams(tournamentId).get();
  for (const teamDoc of teamsSnapshot.docs) {
    const teamData = teamDoc.data();
    const members = teamData.members || [];
    if (members.some((m: any) => m.userId === userId)) {
      return {
        isRegistered: true,
        type: 'team',
        teamName: teamData.name,
      };
    }
  }

  // Check unassigned
  const unassignedDoc = await Collections
    .getTournamentUnassignedPlayers(tournamentId)
    .doc(userId)
    .get();
  
  if (unassignedDoc.exists) {
    return { isRegistered: true, type: 'unassigned' };
  }

  return { isRegistered: false, type: null };
}
```

---

## SUMMARY TABLE: REFACTORING PRIORITY

| Category | File Count | Line Count | Priority | Effort |
|----------|-----------|-----------|----------|--------|
| Firestore path duplication | 8 | 100+ | **CRITICAL** | Low |
| `any` type usage | 15+ | 100+ | **CRITICAL** | Medium |
| Missing return types | 40+ | - | **HIGH** | Low |
| Duplicate validation logic | 5+ | 50+ | **HIGH** | Low |
| Duplicate member management | 4+ | 80+ | **HIGH** | Medium |
| Score calculation duplication | 2 | 40+ | **MEDIUM** | Low |
| Untyped parameters | 20+ | - | **MEDIUM** | Medium |

---

## RECOMMENDED REFACTORING ROADMAP

### Phase 1: Foundation (High Impact, Low Effort)
1. Create `/server/src/utils/firestore-query.utils.ts` - Centralize collection refs
2. Create `/server/src/utils/validation.utils.ts` - Standard validation functions
3. Add return types to all async controller functions
4. Replace `any` types with proper interfaces

### Phase 2: Service Layer (Medium Impact, Medium Effort)
1. Create `/server/src/services/member.service.ts` - Team member operations
2. Create `/server/src/services/match-utils.service.ts` - Match calculations
3. Create `/server/src/services/player.service.ts` - Player operations
4. Enhance `/server/src/services/pool.service.ts` - Pool operations
5. Create `/server/src/utils/response.utils.ts` - Standard responses

### Phase 3: Controller Updates (Medium Impact, Medium Effort)
1. Update all controller functions to use new utility functions
2. Replace inline validation with service calls
3. Consolidate error handling patterns
4. Use centralized response utilities

### Phase 4: TypeScript Improvements (Low Impact, Medium Effort)
1. Create comprehensive type definitions
2. Create typed Request middleware
3. Add strict null checking configuration
4. Document all interface contracts

---

## CRITICAL IMPROVEMENTS FOR EACH MAIN CONTROLLER

### tournament.controller.ts
- Lines 22, 49, 91, 135, 222, 287: Replace `any` types
- Lines 15-29: Use firestore-query utilities
- Lines 225-228, 281-284, 464-467: Use validateTournamentExists
- Lines 507-528, 598-611: Use member.service functions
- All functions: Add return type `Promise<void>`

### admin.controller.ts
- Lines 16, 91, 135, 177, 222, 685: Replace `any` types
- Lines 1125-1127, 1218, 1243: Use validateTeamExists
- Lines 685-730: Use match.service.calculatePoolRanking
- Lines 1785-1826: Consolidate match score update logic
- All functions: Add return type `Promise<void>`

### team.controller.ts
- Lines 79, 156: Replace `any` types
- Lines 171-193: Use member.service.addMemberToTeam
- Lines 74, 136: Use validateTeamCaptain
- All functions: Add return type `Promise<void>`

### match.controller.ts
- Lines 83: Parameterize type for sets array
- Lines 75-104: Replace with match.service.calculateMatchOutcome
- Add return type `Promise<void>` to all functions

---

## FILES TO CREATE

1. `/server/src/utils/firestore-query.utils.ts` - Firestore reference utilities
2. `/server/src/utils/validation.utils.ts` - Standard validation functions
3. `/server/src/utils/response.utils.ts` - Standard response builders
4. `/server/src/utils/batch.utils.ts` - Batch operation helpers
5. `/server/src/services/member.service.ts` - Team member management
6. `/server/src/services/match-utils.service.ts` - Match utility functions
7. `/server/src/services/player.service.ts` - Player operations

---

## FILES TO ENHANCE

1. `/server/src/services/pool.service.ts` - Add missing functions
2. `/server/src/controllers/tournament.controller.ts` - Use utilities
3. `/server/src/controllers/admin.controller.ts` - Use utilities
4. `/server/src/controllers/team.controller.ts` - Use utilities
5. `/server/src/controllers/match.controller.ts` - Use utilities

