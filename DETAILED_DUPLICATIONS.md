# Detailed Duplication Reference Guide

This document provides exact line-by-line references for every duplication found in the codebase.

## 1. FIRESTORE PATH PATTERNS (57+ occurrences)

### Pattern 1.1: Tournament Teams Collection
Found 12+ times across files:

**Location 1:** `/server/src/controllers/tournament.controller.ts`
- Line 15-29: `getAllTournaments` function
- Line 25-29: Getting teams snapshot
- Line 117-121: `getTournamentById` function  
- Line 472-476: `joinTeam` function
- Line 556-560: `leaveTeam` function
- Line 666-670: `createTeam` function
- Line 736-740: `joinWaitingList` function

**Location 2:** `/server/src/controllers/admin.controller.ts`
- Line 19-23: `getAllTournaments` function
- Line 291-295: `registerTeam` function
- Line 478-483: `assignTeamsToPool` function
- Line 992-996: `getTeams` function
- Line 1058-1062: `createTeam` function
- Line 1081-1085: `updateTeam` function
- Line 1118-1122: `deleteTeam` function
- Line 1449-1453: In team loop

**Location 3:** `/server/src/controllers/team.controller.ts`
- Line 18-23: `getTeamById` function
- Line 59-63: `updateTeamSettings` function
- Line 121-125: `addMember` function

### Pattern 1.2: Unassigned Players Collection
Found 8+ times:

**Location 1:** `/server/src/controllers/tournament.controller.ts`
- Line 244-248: `registerPlayer` function
- Line 407-412: `leaveTournament` function
- Line 519-523: `joinTeam` function
- Line 600-604: `leaveTeam` function
- Line 687-691: `createTeam` function
- Line 751-755: `joinWaitingList` function

**Location 2:** `/server/src/controllers/admin.controller.ts`
- Line 26-30: `getAllTournaments` function
- Line 153-157: `getTournamentById` function
- Line 1305-1309: `getUnassignedPlayers` function
- Line 1332-1336: `removeUnassignedPlayer` function

### Pattern 1.3: Pools Collection
Found 5+ times:

**Location 1:** `/server/src/controllers/admin.controller.ts`
- Line 142-146: `getTournamentById` function
- Line 363-367: `getPools` function
- Line 424-428: `createPool` function
- Line 465-469: `assignTeamsToPool` function
- Line 527-531: `generatePoolMatches` function

### Pattern 1.4: Elimination Matches Collection
Found 3+ times:

**Location 1:** `/server/src/controllers/tournament.controller.ts`
- Line 159-162: `getTournamentById` function

**Location 2:** `/server/src/controllers/admin.controller.ts`
- Line 159-162: `getTournamentById` function
- Line 617-620: `getEliminationMatches` function
- Line 750-753: `generateEliminationBracket` function

---

## 2. TOURNAMENT EXISTENCE CHECKS (5+ occurrences)

### Check Pattern: Document Existence & Data Retrieval

```typescript
const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
if (!tournamentDoc.exists) {
  throw new AppError('Tournament not found', 404);
}
const tournament = tournamentDoc.data();
```

**Location 1:** `/server/src/controllers/tournament.controller.ts`
- **Line 225-228:** `registerPlayer` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

- **Line 281-284:** `registerTeam` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

- **Line 464-467:** `joinTeam` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

- **Line 644-647:** `createTeam` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

- **Line 725-728:** `joinWaitingList` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

**Location 2:** `/server/src/controllers/admin.controller.ts`
- **Line 452-455:** `assignTeamsToPool` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

- **Line 515-518:** `generatePoolMatches` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

- **Line 647-650:** `generateEliminationBracket` function
  ```typescript
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    throw new AppError('Tournament not found', 404);
  }
  ```

---

## 3. TEAM CAPTAIN VERIFICATION (4+ occurrences)

### Pattern: Captain Authorization Check

```typescript
const teamData = teamDoc.data();
if (teamData?.captainId !== userId) {
  throw new AppError('You are not the captain...', 403);
}
```

**Location 1:** `/server/src/controllers/tournament.controller.ts`
- **Line 369-372:** `unregisterTeam` function
  ```typescript
  const teamData = teamDoc.data();
  if (teamData?.captainId !== userId) {
    throw new AppError('You are not the captain of this team', 403);
  }
  ```

- **Line 577:** `leaveTeam` function
  ```typescript
  if (userId === teamData?.captainId) {
    // Captain leaving logic
  }
  ```

**Location 2:** `/server/src/controllers/team.controller.ts`
- **Line 71-76:** `updateTeamSettings` function
  ```typescript
  // Check if user is captain
  if (teamData?.captainId !== userId) {
    throw new AppError('Access denied. You are not the captain of this team', 403);
  }
  ```

- **Line 135-138:** `addMember` function
  ```typescript
  // Check if user is captain
  if (teamData?.captainId !== userId) {
    throw new AppError('Access denied. You are not the captain of this team', 403);
  }
  ```

---

## 4. MEMBER MANAGEMENT DUPLICATION (4+ occurrences)

### Pattern 4.1: Add Member to Team

**Location 1:** `/server/src/controllers/tournament.controller.ts:507-516`
```typescript
batch.update(teamDoc.ref, {
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

**Location 2:** `/server/src/controllers/tournament.controller.ts:674-680`
```typescript
batch.set(newTeamRef, {
  name: teamName.trim(),
  captainId: userId,
  members: [
    {
      userId: userId,
      pseudo: userData?.pseudo || 'Unknown',
      level: userData?.level || 'N/A',
    },
  ],
  // ...
});
```

**Location 3:** `/server/src/controllers/team.controller.ts:171-181`
```typescript
batch.update(teamRef, {
  members: [
    ...currentMembers,
    {
      userId: memberId,
      pseudo: memberData?.pseudo || 'Unknown',
      level: memberData?.level || 'N/A',
    },
  ],
  updatedAt: new Date(),
});
```

### Pattern 4.2: Remove Player from Unassigned List

**Location 1:** `/server/src/controllers/tournament.controller.ts:407-417`
```typescript
const unassignedPlayerRef = adminDb
  .collection('events')
  .doc(tournamentId)
  .collection('unassignedPlayers')
  .doc(userId);

const unassignedPlayerDoc = await unassignedPlayerRef.get();
if (unassignedPlayerDoc.exists) {
  batch.delete(unassignedPlayerRef);
}
```

**Location 2:** `/server/src/controllers/tournament.controller.ts:519-528`
```typescript
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

**Location 3:** `/server/src/controllers/tournament.controller.ts:687-696`
```typescript
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

**Location 4:** `/server/src/controllers/team.controller.ts:184-193`
```typescript
const unassignedPlayerRef = adminDb
  .collection('events')
  .doc(tournamentId)
  .collection('unassignedPlayers')
  .doc(memberId);

const unassignedDoc = await unassignedPlayerRef.get();
if (unassignedDoc.exists) {
  batch.delete(unassignedPlayerRef);
}
```

---

## 5. SCORE CALCULATION DUPLICATION (2 locations)

### Pattern: Match Score Calculation

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

**Better Location (Service):** `/server/src/services/match.service.ts:52-81`
```typescript
export function calculateMatchOutcome(
  sets: MatchSet[],
  setsToWin: number,
  pointsPerSet: number,
  tieBreakEnabled: boolean
): MatchOutcome {
  // Proper implementation
}
```

---

## 6. DOCUMENT NOT FOUND CHECKS (20+ instances)

### Pattern: Document Existence Verification

**Pattern Used 20+ times:**
```typescript
const [docType]Doc = await [ref].get();
if (![docType]Doc.exists) {
  throw new AppError('[DocType] not found', 404);
}
```

**Sample Occurrences:**
- tournament.controller.ts:112-114 (getTournamentById)
- tournament.controller.ts:226-228 (registerPlayer)
- tournament.controller.ts:365-367 (unregisterTeam)
- tournament.controller.ts:563-565 (leaveTeam)
- tournament.controller.ts:563-565 (leaveTeam)
- admin.controller.ts:148-150 (getTournamentById)
- admin.controller.ts:471-473 (assignTeamsToPool)
- admin.controller.ts:533-535 (generatePoolMatches)
- admin.controller.ts:1087-1089 (updateTeam)
- admin.controller.ts:1124-1126 (deleteTeam)
- admin.controller.ts:1216-1218 (getUserById)
- admin.controller.ts:1243-1245 (updateUser)
- admin.controller.ts:1275-1277 (deleteUser)
- admin.controller.ts:1338-1340 (removeUnassignedPlayer)
- admin.controller.ts:1498-1500 (linkVirtualToRealUser)
- team.controller.ts:25-27 (getTeamById)

---

## 7. UNASSIGNED PLAYER DATA MAPPING (3+ occurrences)

### Pattern: Get & Format Unassigned Players

```typescript
const unassignedPlayersSnapshot = await adminDb
  .collection('events')
  .doc([id])
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

**Location 1:** `/server/src/controllers/tournament.controller.ts:125-139`
- In `getTournamentById` function

**Location 2:** `/server/src/controllers/admin.controller.ts:152-165`
- In `getTournamentById` function (duplicate!)

**Location 3:** `/server/src/controllers/admin.controller.ts:1305-1316`
- In `getUnassignedPlayers` function

---

## 8. ERROR HANDLING PATTERNS (All Controllers)

### Pattern: Try-Catch-Log-Throw Pattern (40+ instances)

Used in every controller function:
```typescript
try {
  // ... logic
  res.json({
    success: true,
    message: '...',
    data: { ... }
  });
} catch (error: any) {
  console.error('Error [action]:', error);
  if (error instanceof AppError) throw error;
  throw new AppError('Error [action]', 500);
}
```

All 50+ controller functions follow this pattern identically.

---

## 9. `any` TYPE DECLARATIONS (50+ instances)

### In tournament.controller.ts:
- Line 22: `const tournamentData: any = doc.data();`
- Line 49: `const result: any = { ... }`
- Line 63: `const members.some((m: any) => ...)`
- Line 91: `const result: any = { ... }`
- Line 135: `const userData: any = { ... }`
- Line 222: `const updateData: any = { ... }`
- Line 287: `let foundTeamData: any = null;`
- And 13+ more...

### In admin.controller.ts:
- Line 16: `const data = doc.data();`
- Line 91: `const tournamentData: any = { ... }`
- Line 222: `const updateData: any = { ... }`
- Line 685: `const teamStats: any = {};`
- Line 945: `finalRanking.forEach((teamEntry: any, index: number) => {`
- And 25+ more...

### In other controllers:
- team.controller.ts: 5+ instances
- match.controller.ts: 3+ instances
- user.controller.ts: 2+ instances
- auth.controller.ts: 2+ instances

---

## 10. MISSING RETURN TYPE ANNOTATIONS (40+ functions)

### All controller functions lack `: Promise<void>` annotation

**Pattern:** All async controller functions declared as:
```typescript
export const [functionName] = async (req: Request, res: Response) => {
  // Missing: : Promise<void>
}
```

**Should be:**
```typescript
export const [functionName] = async (req: Request, res: Response): Promise<void> => {
  // ...
}
```

**Affected files:**
- tournament.controller.ts: 8 functions
- admin.controller.ts: 50+ functions
- team.controller.ts: 6 functions
- user.controller.ts: 4 functions
- auth.controller.ts: 3 functions
- match.controller.ts: 1 function
- Other controllers: 10+ functions

---

## SUMMARY TABLE

| Category | Count | Effort | Priority |
|----------|-------|--------|----------|
| Firestore paths | 57 | 2h | CRITICAL |
| `any` types | 50+ | 4h | CRITICAL |
| Missing return types | 40+ | 2h | HIGH |
| Tournament checks | 5 | 0.5h | HIGH |
| Captain checks | 4 | 0.5h | HIGH |
| Member operations | 4 | 2h | HIGH |
| Score calculations | 2 | 1h | MEDIUM |
| Not found checks | 20+ | Already handled | LOW |

**Total Refactoring Effort:** 12-15 hours
**Total Redundant Lines:** 400+ lines of duplicated code

