import { Resource, ExperienceMetadata, ConfigResponse, AgentConfig, ValidationReport, AIConfiguration } from './types';
import { ConfigLoader } from './ConfigLoader';
import { HttpLoader } from './HttpLoader';
import { ExperienceURLError, validateAndProcessExperienceURL } from './experience-url-utils';
import { ToolDefinition } from './types';

// Keep track of the current loader instance
let currentLoader: ConfigLoader | null = null;
let configPromise: Promise<ConfigResponse> | null = null;
let lastConfigUrl: string | null = null;

function createLoader(configPath: string): HttpLoader {
    const loader = new HttpLoader();
    loader.basePath = configPath;
    return loader;
}

const initConfig = async (configUrl: string) => {
    try {
        const loader = createLoader(configUrl);
        currentLoader = new ConfigLoader(loader);
        await currentLoader.loadExperience(configUrl);
        return await currentLoader.loadConfig();
    } catch (error) {
        if (error instanceof Error) {
            throw new ExperienceURLError(error.message);
        }
        throw new ExperienceURLError('Unknown error loading Experience configuration');
    }
};

// Getter for the configuration that ensures it's only loaded once per URL
export const getConfig = (experienceUrl: string) => {
    const processedUrl = validateAndProcessExperienceURL(experienceUrl);
    
    // Only initialize if not already loading or URL changed
    if (!configPromise || lastConfigUrl !== processedUrl) {
        lastConfigUrl = processedUrl;
        configPromise = initConfig(processedUrl);
    }
    
    return configPromise;
};

export const getValidationReport = (): ValidationReport | null => {
    if (!currentLoader) {
        return null;
    }
    return currentLoader.getValidationReport();
};

const handleConfigError = async <T>(promise: Promise<T>): Promise<T> => {
    try {
        return await promise;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unexpected error occurred.');
    }
};

export const getAgents = async (experienceUrl: string): Promise<Record<string, AgentConfig>> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.agents));
};

export const getExperienceMetadata = async (experienceUrl: string): Promise<ExperienceMetadata> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.metadata));
};

export const getScenes = async (experienceUrl: string): Promise<Resource[]> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.resources.scenes));
};

export const getSounds = async (experienceUrl: string): Promise<Resource[]> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.resources.sounds));
};

// Added function to get tools from an experience
export const getTools = async (experienceUrl: string): Promise<Record<string, ToolDefinition>> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.tools || {}));
};

// Added function to get AI configurations from an experience
export const getAIConfigurations = async (experienceUrl: string): Promise<Record<string, AIConfiguration>> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.aiConfigurations || {}));
};