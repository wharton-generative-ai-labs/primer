import { Resource } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('SceneManager');

interface SceneManagerConfig {
    scenes: Resource[];
}

type SceneMap = Record<string, Resource>;

const defaultScenes = {
    blank: {
        path: '/images/blank.png',
        url: '/images/blank.png'
    }
} as const;

export type DefaultSceneKeys = keyof typeof defaultScenes; 

export const getDefaultScenes = () => {
    return defaultScenes;
}

export function isValidScene(scene: string): scene is DefaultSceneKeys {
    return scene in defaultScenes;
}

class SceneManager {
    private sceneMap: SceneMap;

    constructor(config: SceneManagerConfig) {
        this.sceneMap = {};
        this.initializeSceneMap(config.scenes);
    }

    private initializeSceneMap(scenes: Resource[]): void {
        this.sceneMap = scenes.reduce((map, scene) => {
            const sceneName = scene.path.split('/').pop()?.split('.')[0] || '';
            if (sceneName) {
                map[sceneName] = scene;
            }
            return map;
        }, defaultScenes as SceneMap);
    }

    addCustomScene(sceneName: string, sceneResource: Resource): void {
        if (!sceneName) {
            logger.warn({}, 'addCustomScene: no sceneName provided');
            return;
        }
        
        this.sceneMap[sceneName] = sceneResource;
        logger.debug({ sceneName, url: sceneResource.url }, 'Added custom scene');
    }

    removeCustomScene(sceneName: string): boolean {
        if (sceneName in defaultScenes) {
            logger.warn({ sceneName }, 'Cannot remove default scene');
            return false;
        }
        
        if (this.sceneMap[sceneName]) {
            delete this.sceneMap[sceneName];
            logger.debug({ sceneName }, 'Removed custom scene');
            return true;
        }
        
        return false;
    }

    getScenePath(sceneName: string | null): string {
        if (!sceneName) {
            logger.warn({}, 'sceneManager.getScenePath no sceneName provided. Using default');
            sceneName = "default";
        }
        if (!this.sceneMap[sceneName]) {
            logger.warn({ sceneName }, 'sceneManager.getScenePath scene not found. Using blank');
            sceneName = "blank";
        }
        logger.debug({ sceneName, url: this.sceneMap[sceneName].url }, 'sceneManager returning path');
        return this.sceneMap[sceneName].url;
    }

    getAvailableScenes(): string[] {
        return Object.keys(this.sceneMap);
    }

    isValidScene(sceneName: string): boolean {
        return sceneName in this.sceneMap;
    }
}

let sceneManagerInstance: SceneManager | null = null;

export const createSceneManager = (config: SceneManagerConfig): SceneManager => {
    sceneManagerInstance = new SceneManager(config);
    return sceneManagerInstance;
};

export const getSceneManager = (): SceneManager => {
    if (!sceneManagerInstance) {
        throw new Error('SceneManager has not been initialized. Call createSceneManager first.');
    }
    return sceneManagerInstance;
};