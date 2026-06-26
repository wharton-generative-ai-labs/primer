import { StorageServiceFactory } from '../storage/StorageServiceFactory';
import path from 'path';

export class ExperienceManagementService {
    private storage = StorageServiceFactory.getInstance();

    private getFullPath(experienceId: string, relativePath: string): string {
        // If the path already starts with the experienceId, use it as is
        if (relativePath.startsWith(`${experienceId}/`) || relativePath === experienceId) {
            return relativePath;
        }
        // Otherwise, join the experienceId with the path
        return path.join(experienceId, relativePath);
    }

    private stripExperienceId(experienceId: string, path: string): string {
        if (path.startsWith(`${experienceId}/`)) {
            return path.substring(experienceId.length + 1);
        }
        return path;
    }

    async createExperience(experienceId: string): Promise<void> {
        // Create the main experience directory
        await this.storage.createDirectory(experienceId);
        
        // Create the basic directory structure
        const directories = [
            'resources',
            'resources/scenes',
            'resources/sounds',
            'resources/instructions',
            'resources/instructions/agent',
            'resources/instructions/supplemental'
        ];

        for (const dir of directories) {
            await this.storage.createDirectory(this.getFullPath(experienceId, dir));
        }

        // Create a basic experience.json
        const defaultConfig = {
            version: "1.0",
            kind: "user",
            title: "New Experience",
            description: "A new interactive educational experience",
            resources: {
                scenes: [],
                sounds: [],
                instructions: {
                    agent: {},
                    supplemental: {}
                }
            },
            agents: {},
            initialAgent: "",
            tools: {
                plugins: ["@primer/builtin-plugin", "@primer/slide-plugin"]
            }
        };

        await this.storage.storeFile(
            this.getFullPath(experienceId, 'experience.json'),
            Buffer.from(JSON.stringify(defaultConfig, null, 2))
        );
    }

    async copyTemplate(templateExperienceId: string, newExperienceId: string): Promise<void> {
        // Create the main experience directory
        await this.storage.createDirectory(newExperienceId);

        // Get all files and directories from the template
        const templateFiles = await this.storage.listFiles(templateExperienceId);
        const templateDirs = await this.getAllDirectories(templateExperienceId);
        
        // Create all subdirectories in the new experience
        for (const dir of templateDirs) {
            const relativePath = path.relative(templateExperienceId, dir);
            const newDirPath = path.join(newExperienceId, relativePath);
            await this.storage.createDirectory(newDirPath);
        }
        
        // Copy each file from template to new experience
        for (const file of templateFiles) {
            const relativePath = path.relative(templateExperienceId, file);
            const newFilePath = path.join(newExperienceId, relativePath);
            
            // Read the template file
            const content = await this.storage.readFile(file);
            
            // Create the new file
            await this.storage.storeFile(newFilePath, content);
        }
        
        // Update experience.json to set kind to "user"
        const experienceJsonPath = path.join(newExperienceId, 'experience.json');
        const experienceContent = await this.storage.readFile(experienceJsonPath);
        const experience = JSON.parse(experienceContent.toString('utf-8'));
        
        // Set kind to "user" for newly created experiences
        experience.kind = "user";
        
        // Write back the updated experience.json
        await this.storage.storeFile(experienceJsonPath, Buffer.from(JSON.stringify(experience, null, 2)));
    }

    async deleteExperience(experienceId: string): Promise<void> {
        // Delete the entire experience directory
        await this.storage.deleteDirectory(experienceId);
    }

    async createDirectory(experienceId: string, directoryPath: string): Promise<void> {
        await this.storage.createDirectory(this.getFullPath(experienceId, directoryPath));
    }

    async deleteDirectory(experienceId: string, directoryPath: string): Promise<void> {
        await this.storage.deleteDirectory(this.getFullPath(experienceId, directoryPath));
    }

    async createFile(experienceId: string, filePath: string, content: Buffer): Promise<void> {
        await this.storage.storeFile(this.getFullPath(experienceId, filePath), content);
    }

    async deleteFile(experienceId: string, filePath: string): Promise<void> {
        await this.storage.deleteFile(this.getFullPath(experienceId, filePath));
    }

    async moveFile(experienceId: string, sourcePath: string, destinationPath: string): Promise<void> {
        // Strip experienceId from paths if they're absolute
        const relativeSourcePath = this.stripExperienceId(experienceId, sourcePath);
        const relativeDestPath = this.stripExperienceId(experienceId, destinationPath);
        
        const fullSourcePath = this.getFullPath(experienceId, relativeSourcePath);
        const fullDestinationPath = this.getFullPath(experienceId, relativeDestPath);
        
        // Read the source file
        const content = await this.storage.readFile(fullSourcePath);
        
        // Create the destination file
        await this.storage.storeFile(fullDestinationPath, content);
        
        // Delete the source file
        await this.storage.deleteFile(fullSourcePath);
    }

    async moveDirectory(experienceId: string, sourcePath: string, destinationPath: string): Promise<void> {
        // Strip experienceId from paths if they're absolute
        const relativeSourcePath = this.stripExperienceId(experienceId, sourcePath);
        const relativeDestPath = this.stripExperienceId(experienceId, destinationPath);
        
        const fullSourcePath = this.getFullPath(experienceId, relativeSourcePath);
        const fullDestinationPath = this.getFullPath(experienceId, relativeDestPath);
        
        // Create the destination directory
        await this.storage.createDirectory(fullDestinationPath);

        // Get all files and directories recursively
        const files = await this.storage.listFiles(fullSourcePath);
        const allDirs = await this.getAllDirectories(fullSourcePath);
        
        // Create all subdirectories in the destination
        for (const dir of allDirs) {
            const relativePath = path.relative(fullSourcePath, dir);
            const newDirPath = path.join(fullDestinationPath, relativePath);
            await this.storage.createDirectory(newDirPath);
        }
        
        // Move each file
        for (const file of files) {
            const relativePath = path.relative(fullSourcePath, file);
            const newPath = path.join(fullDestinationPath, relativePath);
            
            // Read the source file
            const content = await this.storage.readFile(file);
            
            // Create the destination file
            await this.storage.storeFile(newPath, content);
            
            // Delete the source file
            await this.storage.deleteFile(file);
        }
        
        // Delete the source directory and all its contents
        await this.storage.deleteDirectory(fullSourcePath);
    }

    private async getAllDirectories(dirPath: string): Promise<string[]> {
        const result: string[] = [];
        const storage = this.storage;
        
        const traverse = async (dir: string) => {
            const dirs = await storage.listDirectories(dir);
            for (const subDir of dirs) {
                result.push(subDir);
                await traverse(subDir);
            }
        };
        
        await traverse(dirPath);
        return result;
    }
} 