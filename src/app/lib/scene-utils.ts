import { getSceneManager, getDefaultScenes, type DefaultSceneKeys } from './SceneManager';

const defaultScenes = getDefaultScenes();

/**
 * Checks if a scene URL is one of the default scenes
 */
export function isDefaultScene(sceneUrl: string): boolean {
    return Object.values(defaultScenes).some(scene => scene.url === sceneUrl);
}

/**
 * Gets the absolute URL for a scene by its key
 * @param sceneKey The key of the scene in the scene map
 * @param rejectDefaults If true, throws an error if the scene resolves to a default scene
 * @returns The absolute URL of the scene resource
 * @throws Error if scene resolves to a default scene and rejectDefaults is true
 */
export function getSceneUrl(sceneKey: string | DefaultSceneKeys, rejectDefaults: boolean = false): string {
    const url = getSceneManager().getScenePath(sceneKey);

    if (rejectDefaults && isDefaultScene(url)) {
        throw new Error(`Scene '${sceneKey}' resolved to a default scene: ${url}`);
    }

    return url;
}