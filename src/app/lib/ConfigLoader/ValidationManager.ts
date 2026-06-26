/**
 * ValidationManager
 * 
 * Manages validation status tracking for resources during configuration loading.
 * Tracks errors, missing resources, and invalid placeholders.
 */

import { ResourceLoadStatus, ValidationReport } from '../types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ValidationManager');

export class ValidationManager {
    private validationReport: ValidationReport;

    constructor() {
        this.validationReport = {
            statuses: [],
            hasErrors: false
        };
    }

    /**
     * Add a validation status to the report
     * Error statuses override existing statuses for the same object path
     */
    addStatus(status: ResourceLoadStatus): void {
        const existingStatusIndex = this.validationReport.statuses.findIndex(
            s => s.objectPath === status.objectPath
        );
        
        const isError = status.status === 'MISSING' || status.status === 'INVALID_PLACEHOLDER';
        
        if (existingStatusIndex === -1) {
            // No existing status, add new one
            this.validationReport.statuses.push(status);
            if (isError) {
                this.validationReport.hasErrors = true;
            }
        } else if (isError) {
            // Replace existing status with error status
            this.validationReport.statuses[existingStatusIndex] = status;
            this.validationReport.hasErrors = true;
        }
    }

    /**
     * Check if a status already exists for a given object path
     */
    hasStatusForPath(objectPath: string): boolean {
        return this.validationReport.statuses.some(s => s.objectPath === objectPath);
    }

    /**
     * Get the current validation report
     */
    getReport(): ValidationReport {
        return this.validationReport;
    }

    /**
     * Check if there are any validation errors
     */
    hasErrors(): boolean {
        return this.validationReport.hasErrors;
    }

    /**
     * Get formatted error message for all validation errors
     */
    getErrorMessage(): string {
        const errors = this.validationReport.statuses
            .filter(s => s.status === 'MISSING' || s.status === 'INVALID_PLACEHOLDER');
        
        if (errors.length === 0) {
            return 'No validation errors found';
        }

        let message = `Found ${errors.length} validation error${errors.length > 1 ? 's' : ''}:\n\n`;
        
        errors.forEach((error, index) => {
            message += `${index + 1}. ${error.objectPath}\n`;
            message += `   Status: ${error.status}\n`;
            if (error.statusDetail) {
                // Indent the status detail for better readability
                const indentedDetail = error.statusDetail
                    .split('\n')
                    .map(line => `   ${line}`)
                    .join('\n');
                message += `${indentedDetail}\n`;
            }
            message += '\n';
        });
        
        return message.trim();
    }

    /**
     * Reset the validation report (used when loading a new experience)
     */
    reset(): void {
        this.validationReport = {
            statuses: [],
            hasErrors: false
        };
    }

    /**
     * Log the validation report
     */
    logReport(): void {
        if (this.validationReport.hasErrors) {
            logger.error({ validationReport: this.validationReport }, 'Validation report');
        } else {
            logger.debug({ validationReport: this.validationReport }, 'Validation report');
        }
    }
}

