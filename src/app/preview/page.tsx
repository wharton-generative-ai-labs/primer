'use client';

import React, { useState } from 'react';
import PrimerBackground from '../components/PrimerBackground';
import { SplitPanel, PhaseHeading, StepDots } from '../components/redesign';
import { ArrowLeft } from 'lucide-react';

const DEMO_PHASES = [
  'Define Goals',
  'Design Experience',
  'Review & Revise',
  'Build Experience',
  'Ready',
];

function DemoChatPanel() {
  const [messages] = useState([
    { role: 'assistant', text: "Let's start by defining the learning goals for your experience. What subject area are you focusing on?" },
    { role: 'user', text: "I want students to practice giving evidence-based feedback in a professional setting." },
    { role: 'assistant', text: "Great choice! Evidence-based feedback is a valuable skill. Let me ask a few more questions to shape the experience.\n\nWhat level are your students — undergraduate, MBA, or executive education?" },
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">Conversation</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-penn-blue text-white'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 p-3">
        <input
          type="text"
          placeholder="Type a message..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-penn-blue/30"
        />
      </div>
    </div>
  );
}

function DemoDocumentPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <article className="prose prose-slate prose-sm max-w-none">
          <h1 className="font-serif font-bold text-2xl text-slate-900">Lesson Plan for The Feedback Conversation</h1>
          <p className="text-slate-500 text-xs">Draft — updating as you refine goals</p>

          <h3>Overview</h3>
          <p>
            Students will practice delivering clear, evidence-based feedback in a simulated
            professional setting. The experience focuses on distinguishing vague feedback from
            specific, actionable observations grounded in evidence.
          </p>

          <h3>Learning Objectives</h3>
          <ol>
            <li>Identify the components of evidence-based feedback</li>
            <li>Practice delivering feedback that is specific, timely, and constructive</li>
            <li>Reflect on common pitfalls in feedback conversations</li>
          </ol>

          <h3>Target Audience</h3>
          <p>Undergraduate and MBA students in organizational behavior or management courses.</p>

          <h3>Structure</h3>
          <p>
            The simulation will present students with a scenario requiring feedback delivery,
            then guide them through practice rounds with AI-driven role-play.
          </p>
        </article>
      </div>
      <div className="border-t border-slate-100 p-4 flex justify-end">
        <button className="rounded-lg bg-penn-blue px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-penn-blue/90">
          Save Document
        </button>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <PrimerBackground useInitialBackdrop={true}>
      <div className="flex h-full flex-col pt-4 pb-2">
        <SplitPanel
          heading={
            <PhaseHeading>
              {currentStep === 0 && "Let\u2019s start by defining your goals."}
              {currentStep === 1 && "Now let\u2019s design the experience."}
              {currentStep === 2 && "Review and refine your design."}
              {currentStep === 3 && "Your simulation is being built."}
              {currentStep === 4 && "Your simulation is ready!"}
            </PhaseHeading>
          }
          left={<DemoChatPanel />}
          right={<DemoDocumentPanel />}
          focusRight={currentStep === 2}
          nav={{
            breadcrumb: (
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ),
            stepDots: (
              <StepDots total={DEMO_PHASES.length} current={currentStep} />
            ),
          }}
        />
      </div>
    </PrimerBackground>
  );
}
