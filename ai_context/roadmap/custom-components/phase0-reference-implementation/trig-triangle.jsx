/**
 * Trigonometry Triangle Component
 * 
 * Phase 0 Reference Implementation
 * 
 * This is the hand-written test component for validating the runtime system.
 * It demonstrates all key patterns:
 * - State synchronization (prevent circular updates)
 * - Event handling (onEvent, onSubmit)
 * - Loading states (agent processing)
 * - Agent-controlled guidance (hints, steps)
 * - shadcn/ui component usage
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

export default function TrigTriangle({ 
  initialState = {},
  externalState,
  onStateChange,
  onEvent,
  onSubmit,
  instanceId
}) {
  // Initialize state from agent
  const [state, setState] = useState({
    sideA: 5,
    angleC: 30,
    studentAnswer: '',
    showHint: false,
    showSteps: false,
    attempts: 0,
    ...initialState
  });
  
  // Loading state for agent processing
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
  
  // Track externally-set keys to prevent circular updates
  const externallySetKeys = useRef(new Set());
  const previousState = useRef(state);
  
  // Listen for agent updates (externalState changes)
  useEffect(() => {
    if (externalState) {
      // Mark these keys as externally set
      Object.keys(externalState).forEach(key => 
        externallySetKeys.current.add(key)
      );
      
      // Update state with agent's changes
      setState(prev => ({ ...prev, ...externalState }));
      
      // Clear tracking after render cycle
      setTimeout(() => externallySetKeys.current.clear(), 0);
      
      // Clear loading state when agent responds
      setIsWaitingForAgent(false);
    }
  }, [externalState]);
  
  // Notify agent of student-initiated changes only
  useEffect(() => {
    const internalChanges = {};
    
    // Filter out keys that were just set externally
    for (const [key, value] of Object.entries(state)) {
      if (!externallySetKeys.current.has(key) && 
          previousState.current[key] !== value) {
        internalChanges[key] = value;
      }
    }
    
    // Update previous state reference
    previousState.current = state;
    
    // Only notify if there are actual internal changes
    if (Object.keys(internalChanges).length > 0) {
      onStateChange?.(internalChanges);
    }
  }, [state]);
  
  // Calculate correct answer
  const correctAnswer = state.sideA * Math.sin((state.angleC * Math.PI) / 180);
  
  // Handle student checking their answer
  const handleCheck = async () => {
    const answer = parseFloat(state.studentAnswer);
    const correct = Math.abs(answer - correctAnswer) < 0.1;
    
    // Increment attempts
    const newAttempts = state.attempts + 1;
    setState(prev => ({ ...prev, attempts: newAttempts }));
    
    // Show loading state
    setIsWaitingForAgent(true);
    
    // Fire event to agent
    await onEvent?.('answer-checked', { 
      answer, 
      correct, 
      attempts: newAttempts 
    });
    
    // If correct, also call onSubmit
    if (correct) {
      await onSubmit?.({ 
        completed: true, 
        answer, 
        attempts: newAttempts 
      });
    }
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <Card className="w-[600px] max-h-[80vh] overflow-auto">
        <CardHeader>
          <h2 className="text-2xl font-bold">Trigonometry: Find Side B</h2>
          <p className="text-sm text-gray-600">
            Use sine, cosine, or tangent to find the missing side
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Triangle SVG */}
          <svg width="400" height="300" className="mx-auto">
            {/* Right triangle */}
            <line x1="50" y1="250" x2="350" y2="250" stroke="black" strokeWidth="2" />
            <line x1="50" y1="250" x2="50" y2="50" stroke="black" strokeWidth="2" />
            <line x1="50" y1="50" x2="350" y2="250" stroke="black" strokeWidth="2" />
            
            {/* Right angle marker */}
            <rect x="50" y="230" width="20" height="20" fill="none" stroke="black" strokeWidth="1" />
            
            {/* Labels */}
            <text x="200" y="270" textAnchor="middle" fontSize="16" fontWeight="bold">
              Side A = {state.sideA}
            </text>
            <text x="30" y="150" textAnchor="middle" fontSize="16" fontWeight="bold">
              Side B = ?
            </text>
            <text x="80" y="230" fontSize="14">
              {state.angleC}°
            </text>
          </svg>
          
          {/* Hint from agent (shown when state.showHint is true) */}
          {state.showHint && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="font-semibold text-blue-900">Hint:</p>
              <p className="text-blue-800">sin(θ) = opposite / hypotenuse</p>
            </div>
          )}
          
          {/* Working steps from agent (shown when state.showSteps is true) */}
          {state.showSteps && (
            <div className="bg-green-50 border border-green-200 p-4 rounded space-y-2">
              <p className="font-semibold text-green-900">Working:</p>
              <p className="text-green-800">Step 1: sin({state.angleC}°) = Side B / {state.sideA}</p>
              <p className="text-green-800">Step 2: Side B = {state.sideA} × sin({state.angleC}°)</p>
              <p className="text-green-800">Step 3: Side B = {state.sideA} × {Math.sin((state.angleC * Math.PI) / 180).toFixed(3)}</p>
              <p className="text-green-800 font-bold">Step 4: Side B = {correctAnswer.toFixed(2)}</p>
            </div>
          )}
          
          {/* Student input */}
          <div className="space-y-2">
            <Label htmlFor="answer">Your Answer:</Label>
            <Input 
              id="answer"
              type="number"
              step="0.01"
              value={state.studentAnswer}
              onChange={(e) => setState(prev => ({ 
                ...prev, 
                studentAnswer: e.target.value 
              }))}
              placeholder="Enter the length of side B"
              disabled={isWaitingForAgent}
            />
          </div>
          
          {/* Progress indicator */}
          {state.attempts > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Attempts: {state.attempts}
              </p>
              <Progress value={Math.min(state.attempts * 20, 100)} />
            </div>
          )}
          
          {/* Loading overlay (shown while waiting for agent) */}
          {isWaitingForAgent && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p className="text-gray-700 font-medium">Checking your answer...</p>
              </div>
            </div>
          )}
          
          {/* Check answer button */}
          <Button 
            onClick={handleCheck} 
            className="w-full"
            disabled={isWaitingForAgent || !state.studentAnswer}
          >
            Check Answer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

