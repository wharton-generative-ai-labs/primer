"use client";

/**
 * CustomComponents Display Component
 * 
 * Phase 0: Runtime Validation
 * 
 * Renders active custom component instances with per-component error boundaries.
 * Provides slide-like draggable/resizable container for all components.
 */

import React, { useState, useEffect } from 'react';
import { 
  getActiveComponentInstances, 
  subscribeToStateUpdates,
  getComponentManager
} from '@/app/lib/tools/ui/components/ComponentManager';
import { ComponentInstance } from '@/app/lib/tools/ui/components/types';
import { ComponentWrapper } from '@/app/lib/tools/ui/components/ComponentWrapper';
import { createModuleLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

const logger = createModuleLogger('CustomComponents');

/**
 * Error boundary for individual components.
 * Prevents one component's error from crashing all components.
 */
class ComponentErrorBoundary extends React.Component<
  { 
    children: React.ReactNode; 
    instanceId: string;
    componentId: string;
    onRetry: () => void;
    onDismiss: () => void;
  },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(error, `Component error in ${this.props.componentId}`, {
      instanceId: this.props.instanceId,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ComponentError
          componentId={this.props.componentId}
          instanceId={this.props.instanceId}
          error={this.state.error}
          onRetry={() => {
            this.setState({ hasError: false, error: undefined });
            this.props.onRetry();
          }}
          onDismiss={this.props.onDismiss}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error fallback UI for failed components.
 * Displayed within the component wrapper.
 */
function ComponentError({
  componentId,
  instanceId,
  error,
  onRetry,
  onDismiss
}: {
  componentId: string;
  instanceId: string;
  error?: Error;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-2xl font-bold text-red-600">Component Error</h2>
          <p className="text-sm text-gray-600">
            Component: {componentId}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded">
            <p className="text-red-800 font-semibold">Error Details:</p>
            <p className="text-red-700 text-sm mt-2 font-mono">
              {error?.message || 'Unknown error occurred'}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={onRetry}
              variant="default"
              className="flex-1"
            >
              Try Again
            </Button>
            <Button 
              onClick={onDismiss}
              variant="destructive"
              className="flex-1"
            >
              Dismiss
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Instance ID: {instanceId}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main CustomComponents display component.
 * Renders all active component instances.
 */
export function CustomComponents() {
  const [instances, setInstances] = useState<ComponentInstance[]>([]);

  useEffect(() => {
    // Initial load
    setInstances(getActiveComponentInstances());

    // Subscribe to updates
    const unsubscribe = subscribeToStateUpdates(() => {
      setInstances(getActiveComponentInstances());
    });

    return () => unsubscribe();
  }, []);

  const handleRetry = (instanceId: string) => {
    logger.info(`Retrying component instance: ${instanceId}`);
    // Force re-render by updating state
    setInstances(getActiveComponentInstances());
  };

  const handleDismiss = (instanceId: string) => {
    logger.info(`Dismissing component instance: ${instanceId}`);
    const manager = getComponentManager();
    if (manager) {
      manager.hideComponent(instanceId);
    }
  };

  if (instances.length === 0) {
    return null;
  }

  return (
    <>
      {instances.map((instance) => {
        const Component = instance.component;
        
        return (
          <ComponentWrapper
            key={instance.instanceId}
            instance={instance}
            onClose={() => handleDismiss(instance.instanceId)}
          >
            <ComponentErrorBoundary
              instanceId={instance.instanceId}
              componentId={instance.componentId}
              onRetry={() => handleRetry(instance.instanceId)}
              onDismiss={() => handleDismiss(instance.instanceId)}
            >
              <Component {...instance.props} />
            </ComponentErrorBoundary>
          </ComponentWrapper>
        );
      })}
    </>
  );
}

