import { deployArtifact } from '../experience';
import type { Resource } from '../types';

interface FakeFile {
  path: string;
  content: string;
  encoding?: string;
}

function makeContext(opts: {
  artifact: { name: string; type: string; content: string };
  initialFiles: string[];
}) {
  const files: FakeFile[] = opts.initialFiles.map((p) => ({ path: p, content: 'placeholder' }));
  const deletedPaths: string[] = [];

  return {
    files,
    deletedPaths,
    context: {
      experienceId: 'exp-1',
      getArtifact: jest.fn().mockResolvedValue(opts.artifact),
      createFile: jest.fn(async (_id: string, p: string, content: string, encoding?: string) => {
        const existing = files.findIndex((f) => f.path === p);
        if (existing >= 0) files[existing] = { path: p, content, encoding };
        else files.push({ path: p, content, encoding });
      }),
      createDirectory: jest.fn(async () => {}),
      deleteFile: jest.fn(async (_id: string, p: string) => {
        const idx = files.findIndex((f) => f.path === p);
        if (idx >= 0) files.splice(idx, 1);
        deletedPaths.push(p);
      }),
      listResources: jest.fn(async (): Promise<Resource[]> =>
        files.map((f) => ({ path: f.path, type: 'file' as const })),
      ),
    },
  };
}

describe('deployArtifact same-stem sibling sweep', () => {
  it('removes a .jpg placeholder when deploying a .png with the same stem', async () => {
    const { context, deletedPaths, files } = makeContext({
      artifact: { name: 'mentor-scene', type: 'png', content: 'BASE64==' },
      initialFiles: ['resources/scenes/mentor-scene.jpg'],
    });

    const result = await deployArtifact(
      {
        artifactId: 'a1',
        experienceId: 'exp-1',
        destinationPath: 'resources/scenes',
        fileName: 'mentor-scene.png',
      },
      context as any,
    );

    expect(result.status).toBe('success');
    expect(deletedPaths).toEqual(['resources/scenes/mentor-scene.jpg']);
    expect(files.map((f) => f.path).sort()).toEqual(['resources/scenes/mentor-scene.png']);
    expect(result.data.removedSiblings).toEqual(['resources/scenes/mentor-scene.jpg']);
  });

  it('keeps cross-class siblings (mentor.md remains when mentor.png deploys)', async () => {
    const { context, deletedPaths } = makeContext({
      artifact: { name: 'mentor', type: 'png', content: 'BASE64==' },
      initialFiles: ['resources/scenes/mentor.md'],
    });

    await deployArtifact(
      {
        artifactId: 'a1',
        experienceId: 'exp-1',
        destinationPath: 'resources/scenes',
        fileName: 'mentor.png',
      },
      context as any,
    );

    expect(deletedPaths).toEqual([]);
  });

  it('does not delete files with the same stem in a different directory', async () => {
    const { context, deletedPaths } = makeContext({
      artifact: { name: 'mentor-scene', type: 'png', content: 'BASE64==' },
      initialFiles: [
        'resources/scenes/mentor-scene.jpg',
        'resources/other/mentor-scene.jpg',
      ],
    });

    await deployArtifact(
      {
        artifactId: 'a1',
        experienceId: 'exp-1',
        destinationPath: 'resources/scenes',
        fileName: 'mentor-scene.png',
      },
      context as any,
    );

    expect(deletedPaths).toEqual(['resources/scenes/mentor-scene.jpg']);
  });

  it('does not delete the new file path itself when an existing same-extension file is being overwritten', async () => {
    const { context, deletedPaths, files } = makeContext({
      artifact: { name: 'mentor-scene', type: 'png', content: 'NEW==' },
      initialFiles: ['resources/scenes/mentor-scene.png'],
    });

    await deployArtifact(
      {
        artifactId: 'a1',
        experienceId: 'exp-1',
        destinationPath: 'resources/scenes',
        fileName: 'mentor-scene.png',
      },
      context as any,
    );

    expect(deletedPaths).toEqual([]);
    expect(files).toHaveLength(1);
    expect(files[0].content).toBe('NEW==');
  });

  it('skips sweep for unknown asset classes (e.g., .pdf)', async () => {
    const { context, deletedPaths } = makeContext({
      artifact: { name: 'report', type: 'pdf', content: 'BASE64==' },
      initialFiles: ['resources/docs/report.zip'],
    });

    await deployArtifact(
      {
        artifactId: 'a1',
        experienceId: 'exp-1',
        destinationPath: 'resources/docs',
        fileName: 'report.pdf',
      },
      context as any,
    );

    expect(deletedPaths).toEqual([]);
  });
});
