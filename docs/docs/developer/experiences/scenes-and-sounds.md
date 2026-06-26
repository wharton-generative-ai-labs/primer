---
id: scenes-and-sounds
title: Scenes and Sounds
sidebar_position: 4
---

# Scenes and Sounds

Visual and audio elements enhance experiences.

## Scenes

Background images that set context:

```json
{
  "resources": {
    "scenes": [
      "resources/scenes/classroom.png",
      "resources/scenes/office.png"
    ]
  }
}
```

**Best Practices**:
- Use PNG or JPG
- Optimize file size (< 1MB)
- Resolution: 1920x1080 recommended
- Descriptive filenames

## Sounds

Audio files for effects and ambiance:

```json
{
  "resources": {
    "sounds": [
      "resources/sounds/bell.mp3",
      "resources/sounds/success.mp3"
    ]
  }
}
```

**Best Practices**:
- Use MP3 format
- Keep short (< 10 seconds)
- Normalize volume
- Clear, descriptive names

## Agent Usage

Agents can control scenes and sounds:

```typescript
scene({ action: 'set', scene: 'classroom' })
sound({ action: 'play', sound: 'bell' })
```

## Next Steps

- [Tools System](/developer/architecture/tools-system) - Scene and sound tools
- [Creating First Experience](/developer/guides/creating-first-experience)
