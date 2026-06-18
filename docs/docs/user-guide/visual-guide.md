---
id: visual-guide
title: "Visual Guide & Glossary"
sidebar_position: 7
---

# Primer: A Visual Guide & Glossary

*For someone who wants to understand what Primer is, how it works, and what all the pieces are called.*

---

## What Is Primer?

Primer is a platform where **educators describe what they want to teach** (by talking to AI), and Primer **builds an interactive learning experience** that students can play. Students talk to AI characters using their voice, and those characters guide them through lessons using conversation, images, sounds, and on-screen content.

The whole cycle:
1. **Educator talks to AI** → describes what they want
2. **AI builds the experience** → characters, visuals, scripts, everything
3. **Students play the experience** → voice conversation with AI characters
4. **AI analyzes how it went** → reports for the educator
5. **Educator refines** → back to step 1

---

## The Screens

### 1. Sign In

![Sign In](/img/guide/guide17.png)

The first thing you see. Primer uses Google sign-in. Once signed in, you're taken to the Catalog.

---

### 2. Catalog (Home Screen)

![Catalog](/img/guide/guide1.png)

This is the main page — a **browsable list of all available experiences**, displayed as cards.

**What you see:**
- **"Available Experiences"** heading with experience cards below
- Each card shows: **title**, **description**, **version number**, **last modified date**, and **author**
- **Colored badges** on each card indicating what kind of experience it is:
  - **Bundled** (blue) — comes pre-installed with Primer
  - **Meta Experience** (red) — a special experience used for creating other experiences
  - **Debugger** (yellow) — a technical testing tool
  - **User** — created by an educator
- A **three-dot menu** (⋮) on each card for additional actions
- **Search bar** at the bottom to find experiences by name
- **Install Experience** and **Browse Modules** buttons for adding new experiences
- **View** filter and **Admin** button (for administrators)
- Your email and **Sign Out** at the very bottom

**What you can do:**
- Search for experiences
- Click a card to play it
- Install a new experience (upload a `.zip` file)
- Browse the module registry (install pre-made experiences)
- Filter the view (My Experiences, Bundled, Templates)
- Navigate to Admin (if you're an admin)

---

### 3. Catalog — Card Menu

![Card Menu](/img/guide/guide2.png)

Clicking the three-dot menu (⋮) on a card reveals options for that experience:

- **Manage** — go to class management and analytics
- **Edit** — open the file editor for this experience
- **Delete** — remove the experience (with confirmation)

Which options appear depends on your role and permissions.

---

### 4. Play Screen — Clean View

![Play Screen — Clean](/img/guide/guide3.png)

This is where students (or educators previewing) **interact with an experience**. It's the main event.

**What you see:**
- **Header bar** across the top: Wharton logo, experience title (e.g., "Experimental Intake Agent"), and the current agent name (e.g., "Intake") with a dropdown arrow
- **Scene** (background image) filling the main area — here, an illustrated classroom sets the visual mood
- A large **banner or title** that the agent has placed on screen (here: "LET'S CREATE TOGETHER!")
- **Controls** along the bottom-left: Quit (arrow icon), Mute Microphone, Mute AI Audio
- **Controls** along the bottom-right: Transcript, Window Manager, Settings

The AI speaks to you out loud. You speak back using your microphone. The conversation is natural and voice-based.

---

### 5. Play Screen — With Content

![Play Screen — With Content](/img/guide/guide4.png)

As the experience progresses, the AI places **floating windows** over the scene:

- **Slide** (center-left) — a white floating window titled "Lorem Ipsum" containing formatted text with paragraphs. Has a close (×) button and a maximize button. Draggable and resizable.
- **Sticky Notes** (right side) — small colored cards. Here, a **yellow note** ("Note 1") and a **pink note** ("Note 2") with short text. These can be moved around the screen.
- The **scene** remains visible behind everything as the backdrop.
- The **Window Manager** in the bottom bar now shows "Lorem Ipsum" — the name of the open slide — indicating it's tracking open windows.

---

### 6. Play Screen — Controls Bar

![Controls Bar](/img/guide/guide5.png)

The bottom bar of the play screen, zoomed in:

**Left side:**
- **Quit** (arrow icon) — leave the experience
- **Mute Microphone** (mic with slash) — stop sending your voice
- **Mute AI Audio** (speaker icon, highlighted blue when active) — silence the AI's voice

**Center:**
- **Window Manager** — shows the name of the currently selected window (e.g., "Lorem Ipsum") with a dropdown arrow to see all open windows

**Right side:**
- **Transcript** (speech bubble icon) — open/close the conversation transcript
- **Window Manager toggle** (grid icon) — open the window list
- **Settings** (gear icon) — additional options

---

### 7. Play Screen — Transcript

![Transcript](/img/guide/guide6.png)

The **Conversation Transcript** panel opens on the right side of the screen. It shows:

- **Timestamped messages** from the AI agent — a running text log of everything the AI has said
- A **text input box** at the bottom ("Type a message...") where you can also type instead of speaking
- The transcript is in a **floating, closeable window** that can be resized

The scene and any other content remain visible behind/beside the transcript.

---

### 8. Play Screen — Delegation Status

![Delegation Status](/img/guide/guide8.png)

When the voice agent asks a **back-end agent** to do something (delegation), a small status card appears in the corner showing:

- The **agent name** doing the work (e.g., "genericAgent")
- A **loading spinner**
- A **log of what it's doing**: "Starting Generic Agent," "Showing toast," "Setting scene," "Thinking..."

This lets you know that work is happening behind the scenes. It disappears when the task is done.

---

### 9. Play Screen — Window Manager

![Window Manager](/img/guide/guide10.png)

The **Window Manager** dropdown, accessed from the bottom bar. It lists all currently open floating windows:

- Each entry shows an **icon** and **title** (e.g., "Space Fact #1," "Space Fact #2," "Space Fact #3")
- The **type** is shown below each title (e.g., "Slide")
- The **currently selected** window is highlighted (blue)
- Clicking a window brings it to the front or shows/hides it

Think of it like a **taskbar** on a computer desktop — it lets you manage all the content the AI has placed on screen.

---

### 10. Play Screen — Checklist

![Checklist](/img/guide/guide11.png)

A **floating checklist** that tracks progress through tasks:

- **Title** and **progress count** at the top (e.g., "HAL Checklist — 3/9 items (33%)")
- A **progress bar** showing completion visually
- **Sections** with individual tasks that can be checked off
- Completed items show a **green checkmark** and highlight
- The checklist is **draggable and resizable**

The AI agent checks items off as the student progresses, or can show progress at any time.

---

### 11. Play Screen — Session Recovery

![Session Recovery](/img/guide/guide18.png)

If you return to an experience you've played before, this dialog appears:

- **"Continue Previous Session?"** — tells you when the last session was (e.g., "20 minutes ago") and what you were last doing
- Two choices:
  - **Start Fresh** — begin a brand new session
  - **Continue Session** — pick up where you left off

---

### 12. Manage Screen — Classes

![Manage — Classes](/img/guide/guide12.png)

This is where educators **organize students into classes**.

**What you see:**
- **Header**: "Experience Management" with the experience title below it
- **Copy Play Link** button (blue) — generates a shareable URL for students
- **Create Class** button (blue)
- Two tabs: **Classes** and **Analytics**
- **Left panel**: list of classes with name and member count (e.g., "Spring 2026 US History — 4 members")
- **Right panel** (when a class is selected):
  - Class name, description, creation date
  - **Active/Inactive toggle** (green "Active" badge with eye icon)
  - **Delete** button (trash icon)
  - **Members list** showing each student's email and date added
  - **Add Members** button
  - **Remove** button (person icon with minus) next to each member

---

### 13. Manage Screen — Analytics

Analytics lets educators run AI-powered analysis on student sessions. There are three views:

#### Analytics Results

![Analytics Results](/img/guide/guide13a.png)

After running analytics, you see:

- **Analytics tab** selected (underlined)
- **"Run for Class"** button to generate the class-wide report
- **Analytics Results** section with two parts:
  - **Student Reports** — a list of individual students with name, email, date generated, and a **"View"** link
  - **Class Report** — an aggregate analysis with a **"View Class Report"** link

#### Student Report

![Student Report](/img/guide/guide13b.png)

Clicking "View" on a student opens their **Student Performance Report**:

- **Student name**, session ID, date, duration, and experience name
- **Executive Summary** — an AI-written narrative of how the student performed, including specific observations (e.g., "demonstrated significant growth," "progressed from initial confusion to successfully teaching")
- **Overall Assessment** — a rating (e.g., "Developing → Approaching Mastery")
- A **download button** and **close button** at the top

#### Class Report

![Class Report](/img/guide/guide13c.png)

The **Class Performance Analysis Report** shows patterns across all students:

- **Experience name**, learning objectives, class size, date range
- **Executive Summary** — AI-written analysis of class-wide patterns (e.g., "most significant class-wide pattern was initial confusion between Article IV and Article VI")
- **Key Instructional Priority** — actionable recommendation for the educator
- **Overall Performance** — aggregate metrics (e.g., "75% mastered core article identification")

---

### 14. Edit Screen — File Editor

![Edit Screen](/img/guide/guide14.png)

A **file-based editor** for viewing or modifying the files that make up an experience. More technical than the other screens.

**What you see:**
- **Header**: "Editing: \{Experience Title\}" with toolbar buttons:
  - **Run Experience** (green) — launch the experience to test it
  - **Download Experience** (blue) — save as a `.zip` file
  - **Download Session Data** (blue) — export student session data
  - **Quit** — return to the catalog
- **Left sidebar**: a **file tree** showing all folders and files in the experience (e.g., `class_data`, `resources`, `session_data`, `experience.json`)
- **Main area**: a **code editor** showing the selected file with syntax highlighting and line numbers
- Toggle between **Code** and **Inspect** views (top of editor)
- **Save** button

In this example, `experience.json` is open — this is the main configuration file that defines everything about the experience (title, description, AI models, agents, etc.).

---

### 15. Edit Screen — Configuration Inspector

![Config Inspector](/img/guide/guide15.png)

When viewing `experience.json`, clicking **"Inspect"** switches from raw code to a friendly summary:

- **Overview** panel: title, version, config version, kind
- **Statistics** panel with large colored numbers:
  - **Total Agents** (e.g., 5) with breakdown (frontend vs. backend)
  - **Unique Tools** (e.g., 18) across all agents
  - **Scenes** (e.g., 3) plus counts of sounds and components
- **Validation** section — flags any issues or upgrade suggestions

This gives a quick visual overview of what's inside an experience without reading code.

---

### 16. Admin Screen — User Management

![Admin](/img/guide/guide16.png)

Where administrators **manage who can access Primer and what they can do**.

**What you see:**
- **Header**: "User Administration — Manage user accounts and role assignments"
- **Add User** button (blue, top-right)
- **Two sections**:
  - **Environment-Defined Users** — accounts configured in the server environment (locked, shown with a lock icon, cannot be changed here). Each shows email and **role badge** (e.g., ADMIN in green, EDITOR in yellow)
  - **Managed Users** — accounts added through this interface. Each shows email, last modified date, role badge, and **edit** (pencil) and **delete** (trash) buttons

Roles include: **Admin**, **Editor**, **Educator**, **Player**, **Tester**.

---

## Core Concepts Glossary

### Experience

A self-contained, interactive learning scenario. An experience includes everything needed to run: the AI characters, their scripts, background images, sounds, and configuration. Think of it like a **complete lesson plan that runs itself** — students launch it and interact with AI characters who guide them through learning.

Experiences are created by talking to the Intake Agent (itself an experience), or by uploading a pre-made package.

---

### Agent

An AI character that interacts within an experience. Each agent has a name, a personality, a voice, and a set of capabilities (tools). Agents come in two types:

#### Front-End Agent (Voice Agent)

The agent the student **talks to directly**. It speaks with a realistic voice, listens to the student, and controls what appears on screen (slides, notes, scenes, etc.). This is the "face" of the experience — the character the student converses with.

There can be multiple front-end agents in one experience (e.g., a Mentor character, then a Practice Partner character, then a Feedback character), and the experience can transition between them.

#### Back-End Agent

An agent that works **behind the scenes**. The student never talks to it directly. When the voice agent needs something complex done — like generating an image, searching the web, building a document, or analyzing data — it **delegates** the task to a back-end agent. The back-end agent does the work and sends the result back.

Think of it like: the voice agent is the teacher in the room, and back-end agents are assistants in another room doing research, printing materials, or grading papers.

---

### Delegation

When a front-end (voice) agent hands off a task to a back-end agent. For example, the voice agent might say "Let me create something for you" — behind the scenes, it delegates to a back-end agent that does the heavy lifting. The student sees a small status indicator ([see Delegation Status](#8-play-screen--delegation-status)) while this happens.

---

### Instructions (Agent Prompt)

The written script/personality guide for an agent. This is a text document (written in Markdown) that tells the AI **who it is, how to behave, what to do, and what tools to use**. It's like a detailed character brief plus a lesson plan.

Each agent has its own instruction file. For example, a "Mentor" agent's instructions might say: *"You are a warm, encouraging mentor named Dr. Rivera. Start by asking the student what they already know about the topic. Use slides to present key concepts. When they seem ready, transfer them to the Practice agent."*

---

### Supplemental Instructions (Shared)

Instruction files that are **shared across multiple agents** in an experience. Instead of repeating the same information in every agent's instructions, shared content goes in supplemental files. For example, a grading rubric or a list of key vocabulary that all agents should know about.

---

### AI Configuration

The technical settings that control which AI model an agent uses and how it behaves. This includes:
- **Provider** — which AI company (OpenAI or Anthropic)
- **Model** — which specific AI model (e.g., GPT-4o, Claude)
- **Voice settings** — how sensitive the microphone is, how long to wait before responding, whether the student can interrupt

An experience can have multiple AI configurations (e.g., one for voice agents, a different one for back-end agents). You can see these in the [Edit Screen](#14-edit-screen--file-editor) — they appear near the top of `experience.json`.

---

### Scene

A background image that fills the play screen behind all other content. Scenes set the **visual mood and environment** — a cozy classroom, a corporate office, an abstract space. The AI agent can change the scene during the experience to match what's happening in the conversation. See the classroom scene in [Play Screen — Clean View](#4-play-screen--clean-view).

---

### Tool

A capability that an agent can use. Tools are the **actions agents can perform** beyond just talking. Examples:
- Show a slide with content
- Place a sticky note on screen
- Change the background scene
- Play a sound
- Generate an image
- Search the web
- Show a checklist
- Transfer to another agent
- Delegate to a back-end agent

Agents are configured with specific sets of tools — not every agent can do everything.

---

### Tool Group

A named bundle of related tools. Instead of assigning tools one by one, agents are given **groups** of tools. For example:
- **builtin** — core capabilities (scenes, information storage, file handling)
- **slide** — presenting formatted content in floating windows
- **notes** — sticky notes
- **sound** — audio playback
- **delegation** — ability to hand off tasks to back-end agents

---

### Slide

A floating window that appears on the play screen containing **formatted text content** — headings, paragraphs, bullet lists, images. Think of it like a single slide from a presentation that pops up during the conversation. Students can drag it around, resize it, or close it. See [Play Screen — With Content](#5-play-screen--with-content) for an example.

---

### Component (Custom Component)

A floating window containing an **interactive widget** built specifically for an experience. Unlike slides (which are just text), components can be anything: a chart, a quiz, a 3D model, a calculator, a drawing tool. They are custom-coded and can respond to user interaction and communicate back to the AI agent.

---

### Template

A pre-built experience structure that serves as a **starting point** for creating new experiences. Templates define the agent roles, the flow between agents, and the general structure — but leave the specific content to be filled in based on what the educator wants.

Current template types:
- **Roleplay** — students practice interpersonal skills by role-playing with AI characters (e.g., job interviews, negotiations, customer service)
- **Teachback** — students demonstrate understanding by teaching concepts back to an AI character who plays a learner

---

### Intake Agent

A special experience whose job is to **interview an educator and build a new experience** based on what they describe. The educator talks to the Intake Agent using voice, describes their learning objectives, and the Intake Agent orchestrates back-end agents to design and assemble a complete experience.

This is how non-technical educators create experiences — through conversation, not through forms or code. See the Intake Agent in action in [Play Screen — Clean View](#4-play-screen--clean-view) and [Play Screen — Transcript](#7-play-screen--transcript).

---

### Session

A single run-through of an experience by one student. Each session captures everything that happened: the conversation transcript, any artifacts created, and behavioral data. Sessions are stored separately so analytics can be run on them later. If a session is interrupted, the student can resume it ([Session Recovery](#11-play-screen--session-recovery)).

---

### Class

A group of students assigned to a particular experience. Educators create classes, add students by email, and can then run analytics across the whole class to see patterns and generate reports. See [Manage Screen — Classes](#12-manage-screen--classes).

---

### Analytics

AI-powered analysis of student sessions. There are two types:
- **Student Report** — analysis of one student's session (what they understood, where they struggled, what they produced). See [Student Report](#student-report).
- **Class Analytics** — analysis across all students in a class (common patterns, misconceptions, overall outcomes). See [Class Report](#class-report).

Analytics are run by specialized back-end agents that read session data and generate reports.

---

### Artifact

A document or file created during a session — for example, a reflection essay, a summary, a checklist, or notes. Artifacts are saved in the session data and can be reviewed later by the educator.

---

### Window Manager

A toolbar on the play screen that shows all currently open floating elements (slides, notes, components, etc.) and lets you **show, hide, or bring them to the front**. Think of it like a taskbar on a computer desktop. See [Play Screen — Window Manager](#9-play-screen--window-manager).

---

### Observing the UI / Presenting

A system concept where the AI agent can **"see" what's currently on screen** — which slides are open, where notes are positioned, what's visible or hidden — and make decisions about what to show, move, or hide next. The agent doesn't literally see the screen, but it has a data model of all the UI elements and their states.

This is what allows agents to do things like: "I see you still have that earlier slide open — let me close it and show you something new."

---

### Transcript

A running text log of the entire voice conversation between the student and the AI agent(s). Available as a side panel during play ([Play Screen — Transcript](#7-play-screen--transcript)), and saved in session data for later review.

---

## How It All Fits Together (The Big Picture)

```
EDUCATOR                           PRIMER                              STUDENT
─────────                          ──────                              ───────

Talks to Intake Agent ──────────▶  AI interviews educator
                                   AI designs the experience
                                   AI generates scenes, prompts,
                                     characters, everything
                                   ◀──── New Experience appears
                                          in the Catalog

Creates a Class ────────────────▶  Class with student emails
Shares the Play Link ───────────▶  ─────────────────────────────────▶  Gets the link

                                   Student launches experience ◀──────  Clicks Play
                                   Voice agent greets student
                                   Conversation, slides, scenes,
                                     notes, components appear
                                   Back-end agents work behind
                                     the scenes as needed
                                   Session data is saved

Runs Analytics ─────────────────▶  AI reads session data
                                   AI generates reports
                                   ◀──── Reports available

Reviews reports ◀───────────────── Individual + class reports
Refines the experience ─────────▶  (cycle repeats)
```

---

*This guide describes Primer as of March 2026.*
