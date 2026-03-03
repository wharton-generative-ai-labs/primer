When the Experience Builder agent finishes, it knows the ID of the Experience that it just made. This value is (I think) returned in the last response from this agent.

Unfortunately this value doesn't appear to be making it towards to the originating agent (the interactive front-end agent) so that it can successfully create a genuine link to this new Experience on a slide in the front end for the user to try it.

Here's and example of a response from the Experience Builder delegate call:

8:31:02 AM
Result from delegate
{
  "status": "success",
  "data": {
    "message": "Task delegated to Experience Builder and completed successfully.",
    "agentType": "Experience Builder",
    "artifactIds": [
      "experience_summary",
      "mentor_prompt_-_negotiation_simulation",
      "practice_prompt_-_negotiation_simulation",
      "feedback_prompt_-_negotiation_simulation",
      "mentor_scene_negotiation_simulation",
      "practice_scene_negotiation_simulation",
      "feedback_scene_negotiation_simulation"
    ]
  }
}

I suggest we look for the text used in the 'message' property in the return data and see if this is the area where we might still know the actual return value and if we're throwing it away at this stage. If we have the data, let's combine both values into the message property - that is: still inform the caller if the task delegation succeeded or not and which agent call is returning, and then include the original response message from the delegated agent (which ought to include the Experience ID).