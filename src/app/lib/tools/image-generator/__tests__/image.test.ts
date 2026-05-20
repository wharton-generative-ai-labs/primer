import type { ToolContext } from '@/app/lib/tools/types';
import { generateImages } from '../image';
import { getImageGenerationStrategy } from '../strategies';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../strategies', () => ({
  getImageGenerationStrategy: jest.fn(),
}));

const mockedGetStrategy = getImageGenerationStrategy as jest.MockedFunction<
  typeof getImageGenerationStrategy
>;

interface CreatedArtifact {
  name: string;
  content: string;
  type: string;
}

function makeContext(): {
  ctx: ToolContext;
  created: CreatedArtifact[];
} {
  const created: CreatedArtifact[] = [];
  const ctx = {
    createArtifact: jest.fn(
      async (name: string, content: string, type: string) => {
        created.push({ name, content, type });
        return { id: name, name, type };
      },
    ),
  } as unknown as ToolContext;
  return { ctx, created };
}

const ARGS = {
  visualStyle: 'cinematic, painterly, muted palette',
  aspectRatio: '16:9',
  images: [
    { name: 'mentor_scene', description: 'Quiet study room.' },
    { name: 'practice_scene', description: 'Interview office.' },
    { name: 'feedback_scene', description: 'Reflection lounge.' },
  ],
};

describe('generateImages MOCK_GENERATE_IMAGES short-circuit', () => {
  const ORIGINAL_FLAG = process.env.MOCK_GENERATE_IMAGES;

  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) {
      delete process.env.MOCK_GENERATE_IMAGES;
    } else {
      process.env.MOCK_GENERATE_IMAGES = ORIGINAL_FLAG;
    }
    mockedGetStrategy.mockReset();
  });

  it('returns stub artifacts and never calls the strategy factory when MOCK_GENERATE_IMAGES=1', async () => {
    process.env.MOCK_GENERATE_IMAGES = '1';
    const { ctx, created } = makeContext();

    const result = await generateImages(ARGS, ctx);

    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({
      strategy: 'mock',
      model: 'mock',
      imageNames: ['mentor_scene', 'practice_scene', 'feedback_scene'],
    });
    expect(mockedGetStrategy).not.toHaveBeenCalled();

    expect(created).toHaveLength(3);
    for (const artifact of created) {
      expect(artifact.type).toBe('png');
      // 1x1 PNG payload — matches the constant in image.ts. We assert it
      // decodes as the PNG signature bytes so a future edit that breaks
      // the stub fails loudly here.
      const buf = Buffer.from(artifact.content, 'base64');
      expect(buf.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
  });

  it.each(['1', 'true'])(
    'short-circuits when MOCK_GENERATE_IMAGES=%j',
    async (flag) => {
      process.env.MOCK_GENERATE_IMAGES = flag;
      const { ctx } = makeContext();

      const result = await generateImages(ARGS, ctx);

      expect(result.status).toBe('success');
      expect(mockedGetStrategy).not.toHaveBeenCalled();
      mockedGetStrategy.mockReset();
    },
  );

  it.each(['TRUE', '0', 'yes', ''])(
    'does NOT short-circuit when MOCK_GENERATE_IMAGES=%j',
    async (flag) => {
      process.env.MOCK_GENERATE_IMAGES = flag;
      const { ctx } = makeContext();

      const fakeStrategy = {
        name: 'fake',
        supportsModel: jest.fn(() => true),
        generateImage: jest.fn(),
        generateImageWithModel: jest.fn(),
        generateMultiTurn: jest.fn(async () => ({
          images: ARGS.images.map(() => ({ data: 'AAAA' })),
          text: '',
        })),
      };
      mockedGetStrategy.mockReturnValue(fakeStrategy as any);

      await generateImages(ARGS, ctx);

      expect(mockedGetStrategy).toHaveBeenCalled();
      mockedGetStrategy.mockReset();
    },
  );

  it('falls through to the real strategy path when MOCK_GENERATE_IMAGES is unset', async () => {
    delete process.env.MOCK_GENERATE_IMAGES;
    const { ctx, created } = makeContext();

    const fakeStrategy = {
      name: 'fake-strategy',
      supportsModel: jest.fn(() => true),
      generateImage: jest.fn(),
      generateImageWithModel: jest.fn(),
      generateMultiTurn: jest.fn(async () => ({
        images: ARGS.images.map(() => ({
          data: 'AAAA',
          metadata: { mimeType: 'image/png' },
        })),
        text: '',
      })),
    };
    mockedGetStrategy.mockReturnValue(fakeStrategy as any);

    const result = await generateImages(ARGS, ctx);

    expect(mockedGetStrategy).toHaveBeenCalledTimes(1);
    expect(fakeStrategy.generateMultiTurn).toHaveBeenCalledWith({
      visualStyle: ARGS.visualStyle,
      aspectRatio: ARGS.aspectRatio,
      imageSpecs: ARGS.images,
      additionalInstructions: undefined,
    });
    expect(result.status).toBe('success');
    expect(created).toHaveLength(3);
    expect(created[0].content).toBe('AAAA');
  });
});
