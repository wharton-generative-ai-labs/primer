There is a bug with the sound tool. Even when the agent requests a sound that doesn't exist, the tool returns 'success'

For example

8:31:05 AM
ToolRegistry executing sound
{
  "action": "play",
  "name": "non_existent_sound",
  "volume": 0.8
}
8:31:05 AM
Result from sound
{
  "status": "success",
  "data": {
    "item": {
      "output": {
        "success": true,
        "sound": "non_existent_sound",
        "volume": 0.8
      }
    }
  }
}

Fix this such that success is false when it should be.