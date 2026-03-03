#!/bin/bash
# scripts/set-version-env.sh
#
# Safely updates version/build info in .env without touching other variables.
# Uses a marked section to isolate auto-generated values.

set -e  # Exit on any error

ENV_FILE=".env"
START_MARKER="# >>> AUTO-GENERATED BUILD INFO - DO NOT EDIT THIS SECTION <<<"
END_MARKER="# >>> END AUTO-GENERATED BUILD INFO <<<"

# Get current git commit SHA
# Cloud build environments (Heroku, Render) don't include the .git directory,
# so git commands fail. These platforms provide the commit SHA via environment
# variables instead:
#   - Heroku: SOURCE_VERSION (automatically set during slug compilation)
#   - Render: RENDER_GIT_COMMIT (automatically set during builds)
if [ -n "$SOURCE_VERSION" ]; then
  GIT_COMMIT_SHA="$SOURCE_VERSION"
elif [ -n "$RENDER_GIT_COMMIT" ]; then
  GIT_COMMIT_SHA="$RENDER_GIT_COMMIT"
elif git rev-parse HEAD >/dev/null 2>&1; then
  # Local development - git is available
  GIT_COMMIT_SHA=$(git rev-parse HEAD)
else
  GIT_COMMIT_SHA="unknown"
fi

# Get current git branch
# Similar to commit SHA, cloud platforms may provide branch info:
#   - Render: RENDER_GIT_BRANCH (automatically set)
#   - Heroku: Does not provide branch name automatically, but HEROKU_BRANCH
#             can be set manually in app.json env vars if needed
if [ -n "$RENDER_GIT_BRANCH" ]; then
  GIT_BRANCH="$RENDER_GIT_BRANCH"
elif [ -n "$HEROKU_BRANCH" ]; then
  GIT_BRANCH="$HEROKU_BRANCH"
elif git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
  # Local development - git is available
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
else
  GIT_BRANCH="unknown"
fi

# Current timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create .env if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << EOF
$START_MARKER
NEXT_PUBLIC_GIT_COMMIT_SHA=$GIT_COMMIT_SHA
NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
NEXT_PUBLIC_APP_VERSION=$npm_package_version
$END_MARKER
EOF
  echo "Created $ENV_FILE with version info"
else
  # Check if markers already exist
  if grep -q "^# >>> AUTO-GENERATED BUILD INFO" "$ENV_FILE"; then
    # Markers exist - replace the section between them (inclusive)
    TEMP_FILE=$(mktemp)
    trap "rm -f $TEMP_FILE" EXIT
    
    # Extract content before the start marker
    sed -n "1,/^# >>> AUTO-GENERATED BUILD INFO/{ /^# >>> AUTO-GENERATED BUILD INFO/!p; }" "$ENV_FILE" > "$TEMP_FILE"
    
    # Add the new build section
    cat >> "$TEMP_FILE" << EOF
$START_MARKER
NEXT_PUBLIC_GIT_COMMIT_SHA=$GIT_COMMIT_SHA
NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
NEXT_PUBLIC_APP_VERSION=$npm_package_version
$END_MARKER
EOF
    
    # Extract content after the end marker (if any)
    sed -n '/^# >>> END AUTO-GENERATED BUILD INFO/,${/^# >>> END AUTO-GENERATED BUILD INFO/!p;}' "$ENV_FILE" >> "$TEMP_FILE"
    
    # Replace original file
    mv "$TEMP_FILE" "$ENV_FILE"
    trap - EXIT  # Clear the trap since we moved the file
  else
    # Markers don't exist - append the section
    # Ensure there's a newline before our section
    if [ -s "$ENV_FILE" ] && [ "$(tail -c 1 "$ENV_FILE" | wc -l)" -eq 0 ]; then
      echo "" >> "$ENV_FILE"
    fi
    cat >> "$ENV_FILE" << EOF

$START_MARKER
NEXT_PUBLIC_GIT_COMMIT_SHA=$GIT_COMMIT_SHA
NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
NEXT_PUBLIC_APP_VERSION=$npm_package_version
$END_MARKER
EOF
  fi
  echo "Updated $ENV_FILE with version info"
fi

echo ""
echo "Version environment variables:"
echo "  NEXT_PUBLIC_APP_VERSION=$npm_package_version"
echo "  NEXT_PUBLIC_GIT_COMMIT_SHA=$GIT_COMMIT_SHA"
echo "  NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH"
echo "  NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME"
