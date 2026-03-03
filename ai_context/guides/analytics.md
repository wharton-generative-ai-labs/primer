# Student and Class Analytics Architecture

## Executive Summary

This document outlines the architecture for adding comprehensive analytics capabilities to Primer, enabling educators to run AI-powered analysis at both student and class levels. The design emphasizes:

1. **Agent-based analysis** - Analytics are powered by AI agents with prompts, not hard-coded algorithms
2. **Extensibility** - Default analytics prompts are provided but fully editable by educators
3. **Separation of concerns** - Student-level and class-level analytics are distinct operations
4. **Tool-powered file access** - Agents use existing tools to read/write across all student sessions

---

## Current State Analysis

### Storage Structure

```
storage/
├── {experienceId}/
│   ├── experience.json          # Experience configuration
│   ├── classes.json             # Class definitions (members, metadata)
│   ├── resources/               # Experience resources (instructions, scenes, etc.)
│   │   ├── instructions/
│   │   │   ├── agent/           # Agent prompts including analytics agents
│   │   │   └── supplemental/    # Supplemental instructions
│   │   └── scenes/
│   └── session_data/            # Per-session data
│       ├── sess_{uuid}/
│       │   ├── session.json     # Session metadata (userId, email, startTime)
│       │   └── artifacts/       # Session artifacts (transcripts, journals, etc.)
│       └── sess_{uuid2}/
│           └── ...
```

### Key Observations

1. **Sessions are user-scoped** - `session.json` contains `userName` and `userEmail`
2. **Classes define membership** - `classes.json` links emails to a class
3. **Session discovery is implicit** - No index of sessions per user/class exists
4. **Templates exist** - `roleplay-template` and `teachback-template` can hold default analytics prompts

### Existing Analytics Prompts

The roleplay-template already contains two analytics agent prompts:
- `student_report.md` - Individual student performance analysis
- `class_analytics.md` - Aggregate class-level analysis

---

## Proposed Architecture

### 1. Analytics Agent Types

Analytics agents are **regular agents** with a special attribute indicating they can be run manually from the admin interface. They are NOT a new type of agent - they use the existing backend agent infrastructure.

```json
// In experience.json agents section
{
  "agents": {
    "studentReport": {
      "name": "Student Report Agent",
      "publicDescription": "Generates individual student performance reports",
      "type": "backend",
      "aiConfiguration": "instruction-follow",
      "analyticsConfig": {
        "type": "student",           // "student" | "class"
        "runnable": true,            // Shows "Run" button in admin UI
        "outputPath": "analytics/",  // Where to store output (relative path)
        "outputFilename": "student_report.md"  // Template for output filename
      },
      "toolGroups": ["builtin", "experience", "analytics"]
    },
    "classAnalytics": {
      "name": "Class Analytics Agent",
      "publicDescription": "Generates aggregate class performance analysis",
      "type": "backend",
      "aiConfiguration": "instruction-follow",
      "analyticsConfig": {
        "type": "class",
        "runnable": true,
        "outputPath": "class_data/{classId}/",
        "outputFilename": "class_report.md",
        "dependsOn": ["studentReport"]  // Optional: must run after student reports
      },
      "toolGroups": ["builtin", "experience", "analytics"]
    }
  }
}
```

### 2. Storage Organization for Analytics

#### Option A: Hybrid Approach (Recommended)

Keep student-level analytics at the session level, add class-level analytics at experience level:

```
storage/{experienceId}/
├── session_data/
│   └── sess_{uuid}/
│       ├── session.json
│       ├── artifacts/
│       └── analytics/              # NEW: Student-level analytics
│           └── student_report.md
│
├── class_data/                     # NEW: Class-level storage
│   └── {classId}/
│       ├── class_report.md         # Class analytics output
│       ├── sessions_index.json     # Index of sessions belonging to class members
│       └── analytics_history/      # Historical analytics runs
│           └── 2025-11-28_class_report.md
│
└── resources/
    └── instructions/
        └── agent/
            ├── student_report.md   # Default student analytics prompt
            └── class_analytics.md  # Default class analytics prompt
```

#### Sessions Index Structure

To efficiently find sessions for class members, we maintain an index:

```json
// class_data/{classId}/sessions_index.json
{
  "classId": "class-bd9993e8",
  "experienceId": "deckard",
  "lastUpdated": "2025-11-28T10:30:00Z",
  "members": {
    "student@school.edu": {
      "sessions": [
        {
          "sessionId": "sess_abc123",
          "startTime": "2025-11-27T14:00:00Z",
          "hasAnalytics": true,
          "analyticsGeneratedAt": "2025-11-28T09:00:00Z"
        }
      ],
      "latestSession": "sess_abc123",
      "totalSessions": 1
    }
  },
  "totalMembers": 15,
  "membersWithSessions": 12
}
```

### 3. Analytics Tool Requirements

New tools needed for analytics agents:

```typescript
// Analytics-specific tools
interface AnalyticsTools {
  // Session discovery
  listClassSessions(classId: string): Promise<ClassSessionsInfo>;
  getSessionsForUser(userEmail: string): Promise<SessionInfo[]>;
  
  // Cross-session file access
  readSessionFile(sessionId: string, path: string): Promise<string>;
  writeSessionFile(sessionId: string, path: string, content: string): Promise<void>;
  
  // Class data access  
  readClassData(classId: string, path: string): Promise<string>;
  writeClassData(classId: string, path: string, content: string): Promise<void>;
  
  // Batch operations for efficiency
  batchReadSessionFiles(sessions: string[], path: string): Promise<Record<string, string>>;
}
```

Implementation notes:
- These tools extend the existing `experience` tool group
- They use the same underlying `StorageService` infrastructure
- Session file access is scoped to the current experience only (security)

### 4. UI Components

#### A. Analytics Tab on Manage Page

Add a new tab to `/manage/[id]` for analytics:

```
┌─────────────────────────────────────────────────────┐
│  Manage: Experience Name                            │
├──────────┬──────────┬──────────┬───────────────────┤
│ Overview │ Classes  │Analytics │ Files (Editor)    │
├──────────┴──────────┴──────────┴───────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Analytics Agents                            │   │
│  ├─────────────────────────────────────────────┤   │
│  │                                             │   │
│  │ 📊 Student Report Agent                     │   │
│  │    Type: Student-level                      │   │
│  │    [Edit Prompt] [Run for All Students]    │   │
│  │                                             │   │
│  │ 📈 Class Analytics Agent                    │   │
│  │    Type: Class-level                        │   │
│  │    [Edit Prompt] [Run for Class]           │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Analytics Results                           │   │
│  ├─────────────────────────────────────────────┤   │
│  │                                             │   │
│  │ Select Class: [Demo Class ▼]               │   │
│  │                                             │   │
│  │ Student Reports (12/15 complete):          │   │
│  │ ├─ Alice (alice@school.edu) ✓ [View]       │   │
│  │ ├─ Bob (bob@school.edu) ✓ [View]           │   │
│  │ ├─ Charlie (charlie@school.edu) ⏳ Running │   │
│  │ └─ ...                                      │   │
│  │                                             │   │
│  │ Class Report: [View Report] 📊             │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### B. Prompt Editor Component

A modal or slide-out panel for editing analytics prompts:

- Load current prompt from experience resources
- Syntax highlighting (reuse CodeMirrorWrapper)
- Save back to experience resources
- Reset to template default option

#### C. Analytics Results Viewer

Display analytics outputs with:
- Markdown rendering for reports
- Tables and charts (future: AI-generated visualizations)
- Export options (PDF, CSV)
- History of previous runs

### 5. Analytics Execution Flow

#### Student-Level Analytics

```
User clicks "Run for All Students"
         │
         ▼
┌─────────────────────────────────┐
│ 1. Build sessions index         │
│    - Scan session_data folders  │
│    - Match emails to class      │
│    - Update sessions_index.json │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. For each class member:       │
│    - Find their latest session  │
│    - Queue analytics job        │
└─────────────────────────────────┘
         │
         ▼ (parallel or sequential)
┌─────────────────────────────────┐
│ 3. Run Student Report Agent     │
│    - Pass session context       │
│    - Agent reads artifacts      │
│    - Agent writes report        │
│    - Update progress in UI      │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 4. Complete                     │
│    - Update sessions_index      │
│    - Notify UI                  │
└─────────────────────────────────┘
```

#### Class-Level Analytics

```
User clicks "Run for Class"
         │
         ▼
┌─────────────────────────────────┐
│ 1. Verify student reports exist │
│    - Check sessions_index       │
│    - Warn if incomplete         │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. Run Class Analytics Agent    │
│    - Agent reads all reports    │
│    - Agent aggregates data      │
│    - Agent writes class report  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 3. Complete                     │
│    - Store in class_data        │
│    - Notify UI                  │
└─────────────────────────────────┘
```

### 6. API Endpoints

New endpoints needed:

```typescript
// Analytics management
POST /api/analytics/run
  body: { experienceId, classId, agentKey, scope: 'student' | 'class' }
  returns: { jobId, status }

GET /api/analytics/status/:jobId
  returns: { status, progress, results? }

// Sessions index management
GET /api/analytics/sessions-index
  query: { experienceId, classId }
  returns: SessionsIndex

POST /api/analytics/sessions-index/refresh
  body: { experienceId, classId }
  returns: SessionsIndex

// Analytics results
GET /api/analytics/results
  query: { experienceId, classId, type, sessionId? }
  returns: { results: AnalyticsResult[] }
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal**: Basic analytics execution and display

1. **Storage**
   - Add `analytics/` folder to session_data structure
   - Add `class_data/` folder to experience structure
   - Create sessions_index.json builder

2. **Tools**
   - Add `listClassSessions` tool
   - Add `readSessionFile` / `writeSessionFile` tools
   - Add `readClassData` / `writeClassData` tools

3. **Backend**
   - Add `/api/analytics/run` endpoint
   - Add `/api/analytics/results` endpoint
   - Extend backend-agent to handle analytics runs

4. **Frontend**
   - Add Analytics tab to manage page
   - Simple run button and status display
   - Basic results viewer (markdown rendering)

### Phase 2: Enhanced UX

**Goal**: Better progress tracking and prompt management

1. **Real-time Updates**
   - WebSocket progress updates for analytics runs
   - Per-student progress in UI

2. **Prompt Editor**
   - Inline prompt editing in analytics tab
   - Reset to template default
   - Preview mode

3. **Results Enhancement**
   - Rich markdown rendering
   - Basic chart support (chart.js or similar)
   - Export to PDF

### Phase 3: Advanced Features

**Goal**: AI-powered visualizations and automation

1. **AI Visualizations**
   - Visualization Agent that reads reports and decides how to present
   - Dynamic chart/graph generation
   - Dashboard view

2. **Automation**
   - Scheduled analytics runs
   - Automatic class report generation when all students complete

3. **Comparative Analytics**
   - Compare student performance across sessions
   - Compare class performance across cohorts
   - Trend analysis over time

---

## Security Considerations

1. **Authorization**
   - Only experience authors/admins can run analytics
   - Analytics agents cannot access other experiences
   - Session data access is scoped to the current experience

2. **Data Privacy**
   - Student reports are admin-only by default
   - Class reports aggregate data (no PII in summaries)
   - Option to anonymize student identifiers

3. **Rate Limiting**
   - Limit concurrent analytics runs
   - Queue management for large classes
   - Cost tracking for AI API calls

---

## Integration with Experience Editor

The existing ExperienceEditor component can be reused for:

1. **Viewing analytics outputs** - Navigate to `session_data/{sessionId}/analytics/`
2. **Editing prompts** - Navigate to `resources/instructions/agent/`
3. **Managing class_data** - New folder visible in tree

Enhancements needed:
- Special icons for analytics files
- Quick links to jump to relevant files
- Read-only mode for analytics outputs (prevent accidental edits)

---

## Future Considerations

### Full Experience Editor

As mentioned, we may want a more integrated experience editor. The analytics feature could be a stepping stone:

1. **Agent Management Panel**
   - View/edit all agents in experience
   - Configure analytics settings per agent
   - Test agent responses

2. **Resource Browser**
   - Enhanced tree view with metadata
   - Preview pane for non-text files
   - Drag-and-drop organization

3. **Class Management Integration**
   - View class analytics from class management
   - Link students to their sessions
   - Quick actions per student

### Visualization Agents

An interesting future direction: instead of hard-coding chart types, have an AI agent that:
1. Reads the analytics data
2. Decides the best visualization approach
3. Generates the visualization code/config
4. Returns renderable output

This keeps the system flexible and lets the AI adapt to different data types and patterns.

### Cross-Experience Analytics

For institutions with multiple experiences:
- Aggregate performance across experiences
- Student progress tracking over time
- Curriculum-level insights

---

## Technical Notes

### Backend Agent Extensions

The current `backend-agent/route.ts` handles agent execution. For analytics:

1. Add `analyticsConfig` to agent config loading
2. Pass additional context (classId, session list) to analytics agents
3. Handle batch file operations efficiently

### Storage Service Extensions

The `StorageService` needs methods for:
- Listing sessions with metadata
- Batch file reads (reduce API calls)
- Atomic writes (prevent partial updates)

### Session Discovery Algorithm

To build the sessions index:

```typescript
async function buildSessionsIndex(experienceId: string, classId: string) {
  // 1. Load class configuration
  const classConfig = await loadClassConfig(experienceId);
  const targetClass = classConfig.classes.find(c => c.id === classId);
  
  // 2. Get all sessions
  const sessionFolders = await listSessionFolders(experienceId);
  
  // 3. Match sessions to class members
  const index: SessionsIndex = { members: {} };
  
  for (const folder of sessionFolders) {
    const sessionMeta = await loadSessionMetadata(experienceId, folder);
    const email = sessionMeta.userEmail?.toLowerCase();
    
    if (email && targetClass.members.some(m => m.email === email)) {
      if (!index.members[email]) {
        index.members[email] = { sessions: [], totalSessions: 0 };
      }
      index.members[email].sessions.push({
        sessionId: folder,
        startTime: sessionMeta.startTime,
        hasAnalytics: await checkAnalyticsExists(experienceId, folder)
      });
      index.members[email].totalSessions++;
    }
  }
  
  return index;
}
```

---

## Appendix: Existing Analytics Prompts

### Student Report Agent (roleplay-template)

The existing `student_report.md` provides a comprehensive framework for:
- Extracting learning objectives from design document
- Analyzing mentor/practice/feedback transcripts
- Creating evidence matrix per objective
- Generating actionable recommendations

Key features:
- Evidence-based assessments (Mastered/Developing/Needs Support)
- Direct quote attribution
- Instructor-focused recommendations

### Class Analytics Agent (roleplay-template)

The existing `class_analytics.md` provides:
- Batch processing of student reports (5-7 at a time)
- Theme tracking across students
- Common misconception identification
- Teaching moment effectiveness analysis
- Outlier analysis (high/low performers)
- Curriculum refinement suggestions

These prompts can serve as the default templates for new experiences.

---

*Last updated: November 28, 2025*

