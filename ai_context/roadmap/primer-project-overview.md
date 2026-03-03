# Primer Project Overview

This document outlines generally the aims of the project, who it's for, how it should work and what it should do

## Main objectives

  - Educators with no technical expertise can talk to an AI and create a meaningful educational "Experience" for their students.
  - Educators can try out the Experiences they make.
  - Educators can remove Experiences they made which don't meet their needs.
  - Educators can add students to classes for particular experiences.
  - Students in those classes can play the Experiences.
  - Any analytics agents set up for those experiences can be triggered by the educator to produce both individual student and class-level metrics.
  - Users can recover old partially-complete Experiences, in the case that their sessions are cut short because of technical difficulties (compute, network, etc)

## Future aims

  - Admins have an easy way to edit all the agent scripts and the overall composition of Experiences using an interface. (Currently limited to a file editor which is somewhat manual and technical)
  - Tools should be implemented in a 'command/action' pattern. That is: instead of setScene, clearScene, discoverScenes, etc, this could be implemented as 'scene' with a 'set', 'clear', 'discover' actions. This keeps the total number of tools needed to a minimum, aiding clarity for AI agents.
  - All tool calls by agents should run from the backend. That is: even the realtime agent running in the browser should make tool calls via an api call, invoking the actual tool call from the backend implementation, and the results set back to the UI via websocket.
  - All tool calls with UI effects - e.g. showing a Slide with information or setting a scene, playing a sound, etc, can be invoked from backend code, allowing even backend agents to trigger UI effects.
  - All UI effects, where they have visible elements (all except sounds and backend-only tools) should implement an interface which tracks:
    - an ID, kind, 'title', visibility, x, y, width, height
    - e.g. '{uuid}', 'slide', 'summary of decisions', true, 250, 400, 600, 800
  - UI elements should be tracked in a list. This could be used as the foundation for a 'window manager', allowing users to dismiss and re-display the current active UI elements.

## UI Elements

Rework all UI elements to implement an interface
- Id, Kind, Title, State, X, Y, Width, Height
- State is used for things like visible/hidden, etc - what others?
- Make all UI elements register with a UIManager (presentation 'agent'?)
- uiManager can re-present things: minimize them, restore them, close them etc.
- we can "observe" the screen now: uiManager reports the state of all ui elements so the agent can sensibly know how to manipulate things.

## Journaling and artifact inspection

Make it easy for agents to journal (currently implemented, requires check & possible refactor)

Make it easy for educators and administrators to inspect artifacts for particular sessions

Make some form of arbitrary prompt able to run that has access to either a specific session, or all sessions in a class, allowing educators and administrators to conduct ad-hoc research on previous Experience runs.

## Simplify Experience definitions / Use Experience templates

Currently most of the configuration necessary for new Experiences comes from templates, but we still have pre-defined artifacts being described in (and sourced from) the intake-agent Experience itself. For example: checklists.

Make a way where all necessary assets needed for new Experiences can trivially/easily be sourced from within the templates themselves.

Examine whether any of the metadata describing the artifacts in the experience.json is actually needed/inspected/used by the target experience, and re-create anything we still need in a static, simpler fashion within the templates themselves. I don't think the metadata should be needed though.

## Technology

Look into using a different server technology, such that React elements could be dynamically available at runtime. Currently with Next JS. Maybe consider Vite and/or react-runner? We need AI agents to be able to write code for components that conform to a specification, and can be included (rendered) in Experiences immediately.

Currently we're limited to having just text-oriented Experiences, since the UI is effectively 'fixed' at bundling/compile time, but what if AI agents could write the code for new components, for say, a physics-oriented Experience, or a math-oriented Experience, expanding the experience out of the realm of just voice/text interaction and into more fully expansive experiences.