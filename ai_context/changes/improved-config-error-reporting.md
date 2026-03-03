# Improved Configuration Error Reporting

## Overview
Enhanced error reporting throughout the configuration loading pipeline to provide clearer, more actionable error messages when loading experience configurations.

## Changes Made

### 1. ExperienceLoader.ts
**Enhanced JSON Parsing Errors:**
- Added try-catch around `JSON.parse()` with detailed error reporting
- New `createJSONParseError()` method that provides:
  - Full path to the configuration file being parsed
  - The original JSON parse error message
  - Context around the error position (100 characters before/after)
  - Common causes and suggestions for JSON syntax errors
  - Helpful tips for fixing trailing commas, quotes, brackets, etc.

**Added Configuration Structure Validation:**
- New `validateConfigStructure()` method that validates before transformation
- Checks for required top-level fields: `agents`, `resources`, `initialAgent`
- Validates `toolSets` structure for configVersion 2+
- Ensures each toolSet is an array
- Verifies each agent has required `toolSets` array
- Provides clear list of all structural issues found

### 2. AgentConfigBuilder.ts
**Enhanced Tool Expansion Errors:**
- Added try-catch around `expandToolSets()` calls
- Provides context about which agent failed
- Lists the toolSets requested by the agent
- Shows available custom toolSets in the configuration
- Includes the underlying error message

**Enhanced ToolGroups Errors:**
- Similar error handling for legacy toolGroups
- Shows which agent and which groups were requested

### 3. ToolProcessor.ts
**Enhanced ToolSets Processing:**
- Added validation for toolSet structure (must be arrays)
- Added validation for tool names (must be strings)
- Provides clear error messages showing:
  - Which toolSet is invalid
  - What type was expected vs. received
  - Available toolSets in the configuration

**Enhanced Tool Group Registration:**
- Added try-catch around tool group registration
- Shows which group failed to register
- Includes the underlying error message

### 4. groups.ts (expandToolSets function)
**Enhanced ToolSet Resolution:**
- Tracks toolSets that are not found
- Throws descriptive error when toolSets are missing
- Error message includes:
  - List of toolSets that were not found
  - All available preset toolSets
  - All available custom toolSets from experience.json
  - Helpful suggestion to check agent configuration

### 5. HttpLoader.ts
**Enhanced Resource Loading Errors:**
- Improved error messages for failed HTTP requests
- Shows:
  - The objectPath (e.g., "resources.scenes[0]")
  - The original path from configuration
  - The resolved URL that was fetched
  - HTTP status code and message
  - Underlying error for network failures

### 6. ValidationManager.ts
**Enhanced Error Message Formatting:**
- Improved `getErrorMessage()` to provide structured output
- Shows total count of validation errors
- Numbers each error for easy reference
- Indents error details for better readability
- Groups all related information together

### 7. AgentConfigBuilder.ts (Additional Fix)
**Protected Against Undefined downstreamAgents:**
- Added check for missing or invalid `downstreamAgents` field
- Returns empty array if field is undefined or not an array
- Validates that referenced downstream agents actually exist
- Provides clear error with list of available agents if reference is invalid

### 8. play/[id]/page.tsx
**Fixed Validation Report Handling:**
- Added null check for `validationReport.statuses` before calling `.map()`
- Prevents "Cannot read properties of undefined (reading 'map')" error
- Ensures error display works even when validation report is incomplete

## Error Message Examples

### JSON Parse Error
```
Failed to parse experience.json at path: /api/storage/blank/experience.json

JSON Parse Error: Unexpected token } in JSON at position 1234

Context around error:
...
  "toolSets": [
    "default",
  ]
}
...

Common causes:
  - Missing or extra commas
  - Unquoted property names
  - Trailing commas in arrays or objects
  - Unclosed brackets or braces
  - Single quotes instead of double quotes

Please check the JSON syntax and try again.
```

### Missing ToolSet Error
```
ToolSet(s) not found: custom-toolset, another-toolset

Available preset toolSets:
  - default
  - frontend-default
  - backend-default
  - minimal

Available custom toolSets (defined in experience.json):
  - my-custom-set
  - another-set

Please check the toolSet names in your agent configuration.
```

### Configuration Structure Error
```
Invalid experience configuration structure at /api/storage/blank/experience.json:

  - Missing or invalid "agents" object
  - Missing "initialAgent" field
  - Agent "blank" is missing "toolSets" array (required for configVersion 2+)

Please check the configuration file and ensure all required fields are present.
```

### Resource Loading Error
```
Found 2 validation errors:

1. resources.scenes[0]
   Status: MISSING
   Failed to load resource at "resources.scenes[0]"
   Path: resources/scenes/intro.glb
   Resolved URL: /api/storage/blank/resources/scenes/intro.glb
   HTTP Status: 404 Not Found

2. resources.instructions.agent.blank
   Status: MISSING
   Failed to load resource at "resources.instructions.agent.blank"
   Path: resources/instructions/agent/blank.md
   Resolved URL: /api/storage/blank/resources/instructions/agent/blank.md
   HTTP Status: 404 Not Found
```

## Where Errors Appear

### Frontend Display
All configuration errors are caught and displayed in the **ExperienceLoadingStatus** component when loading an experience in the play page (`/play/[id]`). The error appears as:

- A modal overlay with "Experience Error" heading
- Yellow warning icon
- "Error Details" section with formatted error message
- "Return" button to go back to homepage

The error display uses `whitespace-pre-wrap` CSS to preserve the formatting of multi-line error messages, making them easy to read.

### Console/Logs
Errors are also logged to:
- Browser console (for frontend errors)
- Server logs (for backend/API errors)
- Application log files (configured via logger)

## Benefits

1. **Faster Debugging**: Developers can immediately see which file/path is causing issues
2. **Better Context**: Error messages include the configuration path being processed
3. **Actionable Suggestions**: Common causes and fixes are provided
4. **Clear Structure**: Multi-line errors are well-formatted and easy to read
5. **Complete Information**: All relevant context (paths, URLs, available options) is included
6. **Safe Handling**: All `.map()` calls and array operations are now protected against undefined values

## Testing Recommendations

To test these improvements, try:
1. Introducing a JSON syntax error (trailing comma, missing quote)
2. Referencing a non-existent toolSet in an agent
3. Missing required fields like `agents` or `initialAgent`
4. Referencing a resource file that doesn't exist
5. Using an invalid toolSet structure (not an array)

Each should now produce a clear, actionable error message.
