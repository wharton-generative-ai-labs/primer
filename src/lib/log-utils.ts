/**
 * Utilities for smart logging with truncation
 */

/**
 * Truncate long string values in an object for logging purposes
 * 
 * @param obj - The object to process
 * @param maxLength - Maximum length for string values (default: 200)
 * @param truncationSuffix - Suffix to append when truncated (default: '...')
 * @returns A new object with truncated string values
 */
export function truncateForLogging(
  obj: any,
  maxLength: number = 200,
  truncationSuffix: string = '...'
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.length > maxLength) {
      return obj.substring(0, maxLength - truncationSuffix.length) + truncationSuffix;
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => truncateForLogging(item, maxLength, truncationSuffix));
  }

  // Handle objects
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > maxLength) {
      // Truncate long strings
      result[key] = value.substring(0, maxLength - truncationSuffix.length) + truncationSuffix;
      // Add metadata about truncation
      result[`${key}_truncated`] = true;
      result[`${key}_original_length`] = value.length;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects/arrays
      result[key] = truncateForLogging(value, maxLength, truncationSuffix);
    } else {
      // Keep other values as-is
      result[key] = value;
    }
  }
  return result;
}

/**
 * Format tool call data for logging
 * Includes all parameters with smart truncation for readability
 * 
 * @param toolName - Name of the tool being called
 * @param args - Tool arguments
 * @param callId - Unique call identifier
 * @param maxLength - Maximum length for string values (default: 200)
 * @returns Formatted object for logging
 */
export function formatToolCallForLogging(
  toolName: string,
  args: any,
  callId: string,
  maxLength: number = 200
): any {
  return {
    callId,
    toolName,
    args: truncateForLogging(args, maxLength),
  };
}
