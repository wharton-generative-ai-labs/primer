"use client";

import React, { createContext, useState, useCallback } from 'react';
import { getSceneManager } from '../lib/SceneManager';

// Types
export interface SceneState {
    currentScene: string | null;
}

export interface SceneResult {
    result: boolean;
    message?: string;
}

export interface SceneContextType extends SceneState {
    setScene: (sceneName: string) => SceneResult;
    getScenePath: (sceneName: string | null) => string;
    addCustomScene: (sceneName: string, url: string) => SceneResult;
    removeCustomScene: (sceneName: string) => SceneResult;
    getAvailableScenes: () => string[];
}

// Context creation
export const SceneContext = createContext<SceneContextType | null>(null);

// Provider component
export function SceneProvider({
    children
}: {
    children: React.ReactNode
}) {
    const [currentScene, setCurrentScene] = useState<string | null>(null);

    const handleSetScene = useCallback((sceneName: string): SceneResult => {
        if (!sceneName) {
            setCurrentScene("default");
            return {
                result: false,
                message: "No scene name provided, using default"
            };
        }

        const sceneManager = getSceneManager();
        if (!sceneManager.isValidScene(sceneName)) {
            setCurrentScene("blank");
            return {
                result: false,
                message: `Scene '${sceneName}' not found. Using blank scene.`
            };
        }

        setCurrentScene(sceneName);
        return { result: true };
    }, []);

    const getScenePath = useCallback((sceneName: string | null): string => {
        const sceneManager = getSceneManager();
        return sceneManager.getScenePath(sceneName);
    }, []);

    const handleAddCustomScene = useCallback((sceneName: string, url: string): SceneResult => {
        if (!sceneName) {
            return {
                result: false,
                message: "No scene name provided"
            };
        }

        if (!url) {
            return {
                result: false,
                message: "No URL provided"
            };
        }

        const sceneManager = getSceneManager();
        sceneManager.addCustomScene(sceneName, { path: url, url: url });
        return { result: true };
    }, []);

    const handleRemoveCustomScene = useCallback((sceneName: string): SceneResult => {
        const sceneManager = getSceneManager();
        const result = sceneManager.removeCustomScene(sceneName);
        
        // If the current scene is the one being removed, switch to default
        if (currentScene === sceneName) {
            setCurrentScene("default");
        }

        return { result };
    }, [currentScene]);

    const getAvailableScenes = useCallback((): string[] => {
        const sceneManager = getSceneManager();
        return sceneManager.getAvailableScenes();
    }, []);

    const value = {
        currentScene,
        setScene: handleSetScene,
        getScenePath,
        addCustomScene: handleAddCustomScene,
        removeCustomScene: handleRemoveCustomScene,
        getAvailableScenes
    };

    return (
        <SceneContext.Provider value={value}>
            {children}
        </SceneContext.Provider>
    );
}