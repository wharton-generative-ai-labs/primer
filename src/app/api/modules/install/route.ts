import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { resolveAndInstall } from '@/app/lib/modules/ModuleService';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('api-modules-install');

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasMergedPermission(userEmail, Permission.UPLOAD_EXPERIENCE)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { moduleId } = body;

    if (!moduleId || typeof moduleId !== 'string') {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
    }

    logger.info({ moduleId, userEmail }, 'Module install requested');

    const result = await resolveAndInstall(moduleId);

    if (result.errors.length > 0 && result.installed.length === 0) {
      return NextResponse.json(
        { error: 'Installation failed', details: result.errors },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error(error, 'Module install error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Installation failed' },
      { status: 500 }
    );
  }
}
