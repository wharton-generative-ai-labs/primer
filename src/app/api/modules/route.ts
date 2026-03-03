import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getModuleCatalog } from '@/app/lib/modules/ModuleService';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('api-modules');

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ modules: [] });
    }

    const modules = await getModuleCatalog();
    return NextResponse.json({ modules });
  } catch (error) {
    logger.error(error, 'Failed to fetch module catalog');
    return NextResponse.json(
      { error: 'Failed to fetch module catalog' },
      { status: 500 }
    );
  }
}
