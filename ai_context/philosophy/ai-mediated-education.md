# AI-Mediated Education: The Complete Cycle

## The Vision

Primer enables a complete AI-mediated educational cycle where artificial intelligence participates at every stage—from curriculum design to student assessment. This is not automation replacing human judgment; it is AI augmenting human capability at unprecedented scale.

## The Participants

### Educators

Subject matter experts who understand what students need to learn. They provide:
- Learning objectives and outcomes
- Domain expertise and nuance
- Pedagogical preferences
- Assessment criteria

Educators should not need to be technologists. They should be able to describe what they want in natural conversation and receive a functional learning experience.

### Students

Learners who engage with AI-driven experiences. They interact through:
- Natural voice conversation
- Visual content (scenes, diagrams, slides)
- Generated artifacts (documents, reflections)
- Real-time feedback and adaptation

### AI Agents

Intelligent systems that operate throughout the cycle:

| Agent Type | Role | Example |
|------------|------|---------|
| **Intake Agents** | Interview educators, capture requirements | Domain Expert, Pedagogical Advisor |
| **Design Agents** | Create experience structures and content | Experience Architect, Content Generator |
| **Teaching Agents** | Guide students through experiences | Tutor, Mentor, Coach |
| **Backend Agents** | Perform complex tasks during experiences | Research Assistant, Image Generator |
| **Analytics Agents** | Assess and report on student performance | Individual Assessor, Cohort Analyzer |

## The Complete Cycle

```
    ┌────────────────────────────────────────────────────────────┐
    │                                                            │
    ▼                                                            │
┌────────┐    ┌────────────┐    ┌──────────┐    ┌────────────┐  │
│Educator│───▶│ Interview  │───▶│ Generate │───▶│ Experience │  │
│        │    │   Phase    │    │   Phase  │    │  Created   │  │
└────────┘    └────────────┘    └──────────┘    └─────┬──────┘  │
                                                      │         │
                                                      ▼         │
┌────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐   │
│Educator│◀───│ Analytics  │◀───│ Student  │◀───│Experience │   │
│Reviews │    │   Phase    │    │   Phase  │    │ Deployed  │   │
└────────┘    └────────────┘    └──────────┘    └──────────┘   │
    │                                                           │
    └───────────────────────────────────────────────────────────┘
                        (Iteration)
```

### Phase 1: Interview

**Who:** Educator + Intake AI Agents

**What Happens:**
1. Educator begins a conversation with domain-expert AI agents
2. Agents ask probing questions about learning objectives, student context, desired outcomes
3. Agents explore edge cases, assessment approaches, and pedagogical preferences
4. The conversation naturally surfaces information that would be difficult to capture in a form

**Key Insight:** Natural conversation reveals nuance that structured input cannot capture. An educator might say "I want students to really feel the tension in this ethical dilemma" — information that would be lost in a dropdown menu but is perfectly captured by AI.

**Output:** Rich, unstructured interview transcript + initial structured insights

### Phase 2: Generate

**Who:** Design AI Agents (prompted with interview results)

**What Happens:**
1. Design agents analyze interview transcripts
2. Specialized agents handle different aspects:
   - Content generation (explanations, examples, scenarios)
   - Assessment design (rubrics, checkpoints, reflection prompts)
   - Visual design (scene descriptions, diagram concepts)
   - Interaction design (conversation flows, decision points)
3. A novel Experience is synthesized from these contributions
4. The Experience includes all necessary prompts, configurations, and assets

**Key Insight:** No two Experiences are alike. They are not templates with filled blanks but original creations tailored to the educator's specific context.

**Output:** Complete, deployable Experience

### Phase 3: Student Interaction

**Who:** Students + Teaching AI Agents

**What Happens:**
1. Students launch the Experience and are greeted by teaching agents
2. Agents engage in voice conversation, adapting to student responses
3. Visual elements (scenes, slides, diagrams) appear contextually
4. Agents delegate complex tasks to backend specialists:
   - "Generate an image of this concept"
   - "Search for a relevant example"
   - "Create a reflection document"
5. Session data is captured continuously

**Key Insight:** The teaching agents don't follow a script. They have goals, context, and tools—and they determine moment-to-moment how to achieve learning objectives.

**Output:** Rich session data (transcripts, artifacts, behavioral signals)

### Phase 4: Analytics

**Who:** Analytics AI Agents

**What Happens:**
1. Individual Assessment: Each student's session is analyzed
   - Understanding demonstrated
   - Challenges encountered
   - Artifacts produced
   - Behavioral patterns observed
2. Cohort Aggregation: Patterns across students are identified
   - Common misconceptions
   - Effective/ineffective interaction patterns
   - Overall learning outcomes
3. Reports are generated for educators

**Key Insight:** Analytics agents work with unstructured session data and produce meaningful assessments without requiring predefined metrics. They find what's important, not just what was anticipated.

**Output:** Individual reports, cohort summaries, actionable insights

### Phase 5: Iteration

**Who:** Educator (informed by analytics)

**What Happens:**
1. Educator reviews analytics and identifies areas for improvement
2. Returns to interview phase to refine or extend the Experience
3. AI agents incorporate feedback and generate improved versions
4. The cycle continues

**Key Insight:** Iteration is fast because AI handles implementation. An educator can say "students are struggling with the transition between concepts" and agents can redesign that portion.

## What Makes This Different

### vs. Traditional Course Authoring

Traditional tools require educators to:
- Learn complex authoring interfaces
- Structure content into predefined formats
- Manually create assessments and rubrics
- Update content piece by piece

Primer allows educators to:
- Describe what they want in conversation
- Receive complete, ready-to-use Experiences
- Get AI-generated assessments aligned with objectives
- Iterate through conversation, not form-filling

### vs. Chatbot-Based Learning

Simple chatbots:
- Follow scripted conversation paths
- Can't adapt to unexpected responses
- Lack visual and audio richness
- Don't connect to broader learning systems

Primer's AI agents:
- Pursue learning objectives adaptively
- Handle any conversational direction
- Control rich multi-modal experiences
- Generate artifacts and coordinate with other agents

### vs. Adaptive Learning Platforms

Traditional adaptive platforms:
- Adapt based on predefined decision trees
- Require extensive upfront content creation
- Assessment limited to question banks
- Personalization constrained by authored paths

Primer:
- Adapts through AI judgment, not branching logic
- Generates content on demand
- Assessment emerges from conversation
- True personalization through intelligent response

## The Role of Human Judgment

AI-mediated does not mean AI-controlled. Humans remain central:

- **Educators** define objectives and review AI-generated content
- **Students** engage authentically (AI facilitates, doesn't replace learning)
- **Administrators** set policies and access controls
- **Researchers** study effectiveness and improve approaches

AI handles scale, consistency, and the mechanics of interaction. Humans provide wisdom, values, and ultimate judgment.

## Scalability Through Intelligence

The traditional constraint in education: **One expert can only teach so many students directly.**

Primer's solution:

1. **Capture expertise once** through rich AI interview
2. **Replicate as Experience** that can run for unlimited students
3. **Provide individual attention** through AI agents that adapt to each student
4. **Aggregate insights** that would be impossible for a human to compile

This is not replacing the educator. It is extending their reach.

## Technical Enablers

This educational model is enabled by Primer's architectural choices:

| Capability | Technical Foundation |
|------------|---------------------|
| Natural conversation | OpenAI Realtime API (voice) |
| Rich visual content | Scene and slide tools |
| Adaptive response | AI agents with contextual prompting |
| Complex task handling | Backend delegation system |
| Free-form data capture | Unstructured session storage |
| Intelligent assessment | AI analytics with transcript access |

## Future Possibilities

As AI capabilities improve, so does Primer's potential:

- **Real-time learning adjustment** based on detected confusion or mastery
- **Cross-experience insights** where AI identifies patterns across different subjects
- **Collaborative experiences** where multiple students interact with shared AI agents
- **Long-term learning profiles** where AI tracks growth over months and years
- **Automated experience improvement** where AI refines experiences based on outcomes

The architecture is designed to accommodate capabilities that don't yet exist.

## Conclusion

AI-mediated education is not a feature of Primer—it is the reason Primer exists. Every architectural decision, every tool, every design pattern serves this vision: enabling educators to create rich, adaptive, individualized learning experiences that scale beyond what was previously possible.

The complete cycle—Interview, Generate, Interact, Analyze, Iterate—represents a new model for how educational content is created, delivered, and improved. AI participates at every stage, but always in service of human learning and human wisdom.

---

*This document describes the educational vision of Primer as of January 2026.*
