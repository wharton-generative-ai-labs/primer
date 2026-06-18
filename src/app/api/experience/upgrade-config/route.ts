/**
 * API endpoint to upgrade experience.json to the latest config version
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { experienceId, configContent } = await request.json();

    if (!experienceId || !configContent) {
      return NextResponse.json(
        { error: 'Missing experienceId or configContent' },
        { status: 400 }
      );
    }

    // Parse the current config
    const config = JSON.parse(configContent);
    const currentVersion = config.configVersion || 1;

    // Only upgrade if version is less than 2
    if (currentVersion >= 2) {
      return NextResponse.json(
        { error: 'Configuration is already at the latest version' },
        { status: 400 }
      );
    }

    // Import the upgrade logic
    const { upgradeConfig } = await import('./upgradeLogic');
    const upgradedConfig = upgradeConfig(config);

    // Write the upgraded config back to the file
    const fs = await import('fs/promises');
    const path = await import('path');
    const storageRoot = env.STORAGE_ROOT_PATH || './storage';
    const filePath = path.join(process.cwd(), storageRoot, experienceId, 'experience.json');

    await fs.writeFile(filePath, JSON.stringify(upgradedConfig, null, 2), 'utf-8');

    logger.info({ experienceId, from: currentVersion, to: upgradedConfig.configVersion }, 'Upgraded experience config');

    return NextResponse.json({
      success: true,
      upgradedConfig,
      message: `Successfully upgraded from v${currentVersion} to v${upgradedConfig.configVersion}`
    });

  } catch (error) {
    logger.error({ error }, 'Failed to upgrade config');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upgrade configuration' },
      { status: 500 }
    );
  }
}
