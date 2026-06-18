# Diagram 4: The Student Experience

## From Class Enrollment to Analytics

```mermaid
flowchart TB
    classDef educator fill:#2d3748,stroke:#e2e8f0,color:#e2e8f0,stroke-width:2px
    classDef student fill:#3182ce,stroke:#bee3f8,color:#fff,stroke-width:1px
    classDef agent fill:#805ad5,stroke:#d6bcfa,color:#fff,stroke-width:1px
    classDef artifact fill:#d69e2e,stroke:#fefcbf,color:#1a202c,stroke-width:1px
    classDef analytics fill:#38a169,stroke:#c6f6d5,color:#fff,stroke-width:1px
    classDef output fill:#e53e3e,stroke:#fed7d7,color:#fff,stroke-width:2px

    subgraph SETUP["① Class Setup"]
        direction TB
        EDU[/"👤 Educator"/]:::educator
        CLASS["Creates a Class\n(list of students)\nfor this Experience"]:::educator
        EDU --> CLASS
        CLASS --> INVITE["Students receive\naccess to the\nExperience"]:::student
    end

    subgraph SESSION["② Student Session (Real-Time Voice)"]
        direction TB
        
        STU[/"🎓 Student\nlogs in and\nlaunches Experience"/]:::student

        subgraph MENTOR_PHASE["Phase 1: Mentor"]
            direction TB
            M_AGENT["🎭 Mentor Agent\n(Voice Conversation)"]:::agent
            M_SCENE["🖼️ Mentor Scene\n(backdrop image)"]:::artifact
            M_DO["Introduces concepts,\nteaches frameworks,\nprovides examples,\nbriefs student on\nupcoming practice"]:::artifact
            M_SLIDES["📊 Slides shown\nwith key information\n(data, frameworks,\nbriefing materials)"]:::artifact
            M_JOURNAL["📓 Writes to Journal:\nwhat was taught,\nstudent questions,\nareas of strength"]:::artifact
        end

        STU --> MENTOR_PHASE

        subgraph PRACTICE_PHASE["Phase 2: Practice"]
            direction TB
            P_AGENT["🎭 Practice Agent\n(Different Voice & Character)"]:::agent
            P_SCENE["🖼️ Practice Scene\n(new backdrop)"]:::artifact
            P_DO["Roleplay: Realistic counterpart\n(skeptical client, anxious patient...)\n─────────────────────\nTeachback: Curious learner\nwho asks follow-up questions"]:::artifact
            P_ADAPT["Adapts difficulty:\nstruggles → hints & scaffolding\nexcels → harder challenges"]:::artifact
            P_JOURNAL["📓 Writes to Journal:\nstudent choices,\nkey moments,\nsuccesses & struggles"]:::artifact
        end

        MENTOR_PHASE -->|"Handoff\n(new voice,\nnew scene)"| PRACTICE_PHASE

        subgraph FEEDBACK_PHASE["Phase 3: Feedback"]
            direction TB
            F_AGENT["🎭 Feedback Agent\n(Often returns to\nMentor's voice)"]:::agent
            F_SCENE["🖼️ Feedback Scene\n(reflective backdrop)"]:::artifact
            F_DO["Reads full Journal,\nevaluates performance\nagainst learning objectives,\nreferences specific moments"]:::artifact
            F_JOURNAL["📓 Writes to Journal:\nassessment, strengths,\ngrowth areas,\nkey takeaway"]:::artifact
        end

        PRACTICE_PHASE -->|"Handoff"| FEEDBACK_PHASE
    end

    subgraph JOURNAL_DETAIL["The Session Journal (Shared Across All Agents)"]
        direction LR
        JD["A persistent document that every agent reads before acting\nand writes to after acting — the connective tissue of the session.\nIt ensures continuity across handoffs: the Feedback Agent knows\nexactly what the Mentor taught and what happened in Practice."]:::artifact
    end

    SESSION --- JOURNAL_DETAIL

    subgraph DATA["③ Session Data Captured"]
        direction LR
        SD1["Full conversation\ntranscript"]:::artifact
        SD2["Journal entries\nfrom all agents"]:::artifact
        SD3["Artifacts created\nduring session"]:::artifact
        SD4["Checklist\nprogress"]:::artifact
    end

    SESSION --> DATA

    subgraph ANALYTICS["④ Analytics (Educator-Triggered)"]
        direction TB
        
        subgraph INDIVIDUAL["Per-Student Analysis"]
            direction TB
            SR["Student Report Agent\n(Backend)"]:::analytics
            SR_OUT["📄 Individual Report\n• Understanding demonstrated\n• Challenges encountered\n• Specific moments referenced\n• Growth recommendations"]:::output
        end

        subgraph AGGREGATE["Class-Level Analysis"]
            direction TB
            CA["Class Analytics Agent\n(Backend, runs after\nall student reports)"]:::analytics
            CA_OUT["📄 Class Report\n• Common misconceptions\n• Effective interaction patterns\n• Overall learning outcomes\n• Cohort-level insights"]:::output
        end

        INDIVIDUAL --> AGGREGATE
    end

    DATA --> ANALYTICS

    subgraph REVIEW["⑤ Educator Reviews Insights"]
        direction TB
        EDU2[/"👤 Educator receives\nactionable insights\nabout individual students\nand the class as a whole"/]:::educator
        ITER["Can iterate on the\nExperience design\nbased on what\nstudents struggled with"]:::educator
        EDU2 --> ITER
    end

    ANALYTICS --> REVIEW
```

## Annotation

The student experience begins before the student ever speaks a word. The **educator creates a class** — a roster of students assigned to a specific Experience. Students receive access, log in, and launch the Experience from a catalog.

The session itself is a **real-time voice conversation** with a sequence of AI agents, each occupying a distinct phase. The student speaks into their microphone and hears the AI respond with an expressive, realistic voice — not text-to-speech but the OpenAI Realtime API's native voice synthesis. A live transcript sidebar shows the conversation as it unfolds, and visual elements — scene backdrops, informational slides, reference documents — appear in draggable, resizable windows that the student can arrange.

The **Mentor Agent** opens the session, setting the scene (literally — a background image appears), introducing key concepts, teaching frameworks with concrete examples, and briefing the student on the upcoming practice challenge. Information-dense content is presented on slides rather than spoken at length. When the student is ready, the Mentor hands off to the **Practice Agent**, which arrives with a different voice and a new scene backdrop — a deliberate sensory signal that the dynamic has shifted. In a Roleplay experience, the Practice Agent embodies a realistic counterpart (a skeptical journalist, a difficult client, an anxious patient) and stays in character throughout. In a Teachback experience, it plays a curious learner who asks probing follow-up questions. The agent adapts in real time: if the student struggles, it offers scaffolding; if the student excels, it escalates the challenge. After practice, the **Feedback Agent** — often returning to the Mentor's voice — reads the full session journal and delivers a targeted evaluation, referencing specific moments from the practice session and connecting them to the learning objectives.

The **session journal** is the critical connective tissue. It is a persistent document that every agent reads before acting and writes to after acting. The Mentor records what was taught; the Practice Agent logs what happened; the Feedback Agent synthesizes it all into an assessment. This shared memory is what makes the three-agent handoff feel like a coherent experience rather than three disconnected conversations.

After the session, all data — transcripts, journal entries, artifacts, checklist progress — is stored in the session directory. When the educator is ready, they can trigger **analytics agents**: the **Student Report Agent** analyzes each individual session, producing a report that references specific moments and identifies strengths and growth areas. The **Class Analytics Agent** then aggregates across all student reports, surfacing common misconceptions, effective interaction patterns, and cohort-level insights. Both analytics agents are fully customizable — their prompts are part of the experience definition, meaning the educator (or the meta-experience that created the experience) controls exactly what is assessed and how. The educator receives these reports and can use them to iterate on the Experience design, closing the loop from creation to delivery to insight.
