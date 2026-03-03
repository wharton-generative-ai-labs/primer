import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { checkDependencies } from '@/app/lib/modules/ModuleService';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('api-modules-check-deps');

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ missing: [] });
    }

    const experienceId = request.nextUrl.searchParams.get('experienceId');
    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
    }

    const missing = await checkDependencies(experienceId);
    return NextResponse.json({ missing });
  } catch (error) {
    logger.error(error, 'Dependency check error');
    return NextResponse.json({ missing: [] });
  }
}
