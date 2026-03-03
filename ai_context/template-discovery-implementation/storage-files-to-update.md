# Storage Files to Update Manually

These files are NOT under source control and must be manually updated on staging and production servers.

All files are in the `/storage/intake-agent/` directory:

## Files Changed:

1. **resources/instructions/supplemental/templates.md**
   - Added Template Discovery section
   - Changed section headers from hyphenated to title case
   - Removed hardcoded folder name references

2. **resources/instructions/agent/intake.md**
   - Added template discovery examples with `listTemplateExperiences`
   - Changed all template references to use UUIDs instead of fixed names
   - Added critical warnings about never assuming folder names

3. **resources/instructions/agent/casting-director.md**
   - Updated to clarify Template ID is a folder name (UUID)
   - Renamed sections to emphasize folder IDs
   - Added template verification examples

4. **resources/instructions/agent/experience-builder.md**
   - Changed all examples to use UUID-based template IDs
   - Added critical notes about folder names vs friendly names
   - Updated documentation throughout

5. **resources/instructions/agent/design-agent.md**
   - Updated to use UUID examples instead of fixed names
   - Added critical notes about Template ID being a folder name
   - Changed example template IDs

## Quick Copy Commands (from repo to server):

```bash
# Set these variables for your environment
SERVER="user@staging-server"
STORAGE_PATH="/path/to/storage/intake-agent/resources/instructions"

# Copy supplemental file
scp storage/intake-agent/resources/instructions/supplemental/templates.md \
    $SERVER:$STORAGE_PATH/supplemental/

# Copy agent files
scp storage/intake-agent/resources/instructions/agent/intake.md \
    $SERVER:$STORAGE_PATH/agent/

scp storage/intake-agent/resources/instructions/agent/casting-director.md \
    $SERVER:$STORAGE_PATH/agent/

scp storage/intake-agent/resources/instructions/agent/experience-builder.md \
    $SERVER:$STORAGE_PATH/agent/

scp storage/intake-agent/resources/instructions/agent/design-agent.md \
    $SERVER:$STORAGE_PATH/agent/
```

## Verification After Update:

1. Check that files copied correctly:
   ```bash
   ssh $SERVER "ls -la $STORAGE_PATH/agent/ && ls -la $STORAGE_PATH/supplemental/"
   ```

2. Test the Intake Agent can discover templates:
   - Start a new session with Intake Agent
   - Agent should use `listTemplateExperiences` during template selection
   - Verify it uses discovered UUIDs instead of assuming "roleplay-template"

3. Test full pipeline:
   - Complete experience creation from start to finish
   - Verify Casting Director receives UUID-based template ID
   - Verify Experience Builder successfully copies template using UUID
