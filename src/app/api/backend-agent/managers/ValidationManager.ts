/**
 * ValidationManager
 * 
 * Handles validation of backend agent requests including:
 * - Request body validation
 * - Header validation
 * - Required field checks
 */

import { NextRequest } from 'next/server';
import { createModuleLogger } from '@/lib/logger';
import type { BackendAgentRequest, ValidatedRequest } from './types';

const logger = createModuleLogger('backend-agent-validation');

export class ValidationManager {
  /**
   * Validate and extract all required data from the request
   */
  static async validateRequest(
    request: NextRequest,
    userEmail: string
  ): Promise<{ valid: true; data: ValidatedRequest } | { valid: false; error: string; status: number }> {
    try {
      // Parse request body
      const body: BackendAgentRequest = await request.json();
      
      // Extract and validate body fields
      const {
        agentType,
        artifactIds = [],
        taskDescription = '',
        experienceId,
        imageNames = [],
        delegationId
      } = body;

      // Validate experienceId
      if (!experienceId) {
        logger.warn('Missing experienceId in request');
        return {
          valid: false,
          error: 'Experience ID is required',
          status: 400
        };
      }

      // Validate sessionId from headers
      const sessionId = request.headers.get('x-session-id');
      if (!sessionId) {
        logger.warn('Missing x-session-id header');
        return {
          valid: false,
          error: 'Session ID is required',
          status: 400
        };
      }

      // Validate agentType
      if (!agentType || typeof agentType !== 'string' || agentType.trim().length === 0) {
        logger.warn({ agentType }, 'Invalid agentType');
        return {
          valid: false,
          error: 'Agent type is required and must be a non-empty string',
          status: 400
        };
      }

      // Validate arrays
      if (!Array.isArray(artifactIds)) {
        logger.warn({ artifactIds }, 'artifactIds must be an array');
        return {
          valid: false,
          error: 'artifactIds must be an array',
          status: 400
        };
      }

      if (!Array.isArray(imageNames)) {
        logger.warn({ imageNames }, 'imageNames must be an array');
        return {
          valid: false,
          error: 'imageNames must be an array',
          status: 400
        };
      }

      logger.debug({
        agentType,
        experienceId,
        sessionId,
        delegationId,
        artifactCount: artifactIds.length,
        imageCount: imageNames.length,
      }, 'Request validation successful');

      return {
        valid: true,
        data: {
          agentType,
          artifactIds,
          taskDescription,
          experienceId,
          imageNames,
          delegationId,
          sessionId,
          userEmail
        }
      };
    } catch (error) {
      logger.error(error, 'Request validation error');
      return {
        valid: false,
        error: 'Invalid request body',
        status: 400
      };
    }
  }
}

