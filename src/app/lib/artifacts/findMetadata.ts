import fs from 'fs/promises';
import path from 'path';

/**
 * Find the metadata JSON filename for an artifact id within a session artifacts folder.
 */
export async function findMetadataFileByArtifactId(
  artifactsFolder: string,
  artifactId: string,
): Promise<string | null> {
  try {
    const files = await fs.readdir(artifactsFolder);
    const jsonFiles = files.filter((file: string) => file.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(artifactsFolder, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const metadata = JSON.parse(content) as { id?: string };
        if (metadata.id === artifactId) {
          return file;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}
