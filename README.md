Alexa Integration: Free room notification
-----------------------------------------

A very basic skill for Alexa that will read out the names of meeting rooms
that have no events scheduled in them at the time the skill is invoked.

It requires a few things:

1. A `service-account.json` that contains the service account definition that will be used to connect
   to the API.

2. That the meeting rooms have a ` (CPT)` or ` (JHB)` (case-insensitive) appended to the name of the
   meeting room.

## Please note

This is not meant to be released ready-to-use. It will more than likely require configuration from your
side if you choose to use it.

It was implemented as part of a challenge within our office, and is placed here for a demo of how to
write Alexa skills hosted within Amazon Lambda.
