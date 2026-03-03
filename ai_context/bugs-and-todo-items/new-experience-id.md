When Experiences are created by the Experience builder, and template Experience folders are copied into a new folder to house the experience being created, the random ID being used for these new Experience folders is now a uuid.

However, when experiences are uploaded via the Experience Catalog ("Install Experience") they use a simpler random folder naming algorithm which I prefer.

Let's modify the tool that copies experience templates to use the same naming system as when experiences are installed.