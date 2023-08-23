# pythia.ts

[pythia.ts](./pythia.ts)

# ANSWER A QUESTION

```
EXACT_ANSWER = LOOKUP_EXACT(QUESTION)

IF EXACT_ANSWER IS FOUND
  RETURN EXACT_ANSWER
END

SYNTHETIC_ANSWER = SYNTHESIZE_ANSWER(QUESTION)

IF SYNTHETIC_ANSWER IS FOUND
  RETURN SYNTHETIC_ANSWER
END

SEEK_KNOWLEDGE(QUESTION)

ANSWER_QUESTION(QUESTION)

```

# SEEK KNOWLEDGE

```
IF STOP = TRUE
  RETURN NULL
ELSE
  READ_THING(QUESTION, THING)
  NEXT_THING = DECIDE_WHAT_TO_READ(QUESTION, THING)
  SEEK_KNOWLEDGE(NEXT_THING)
END
```

# Self-Refine

The prompts involved:

- responder (generates a response to a question)
- feedback (given a response, generate feedback using some rubric)
- iterate (given a sequence of responses and feedbacks, generate a response)

# FUNCTION

An LLM worker has a few components:

- example
- databases
- goal
- history
  - analyze
  - plan
  - dispatch
  - observe
- feedback
- refine

An LLM function has a few components:

# Iterate Function

The "iterate function" takes a nrlshell session and steps it forward

A ghost is the thing inside the shell session that does the iteration.

the iterate step basically says:

- pick a function
- generate the inputs
- call the function
- read the outputs
- feedback on the outputs
-

# NRLSHELL

- shells (a shell is a natural langugae comand prompt)
- ghosts (a ghost is an autonomous agent inside a shell)
- machines (a machine is a function that takes inputs and gives you outputs)
  - a machine exists outide the network. machines can do things with side effects

a shell is the thing the ghost uses to operate a machine

- you connect to a machine and get a shell
- the ghost tells you what the machine is good at
- the ghost crafts the inputs it needs
- the ghost decides what to call next

# SYNTHETIC/ANALYTIC

prompt -> is analytic? -> synthesize -> repeat

- analyze a synthetic prompt
  - what are the key details that are in the prompt
  - what are the key details that aren't in the prompt
  - synthesize missing details
- synthesize
  - what is the missing detail?
  - ok, how can i go about getting this detail
  - get the detail
  - did i get the detail
  - try again

if synthesis results in a context that's too big, the way to respond is by generating a higher-level plan and then prompting the user that we will need to do things one at a time

# First Machine

The machine will answer users' questions. It will have the ability to look up answers on a single website.

1. list the details in the prompt
2. what details are not in the prompt
3. for each missing detail, synthesize
4. combine the details into a prompt
5. reduce the prompt into an answer

# Neural Shell

We really have three core ideas here:

- trajectories
- nrlshell execution framework
- analysis

# Overview

`neural-shell` is a framework for authoring autonomous and semi-autonomous
language model functions.

# Protocol

See [protocol.ts](protocol.ts) for type definitions.

The general idea is that you start by connecting to a machine. When you connect
to a machine, you get a shell on the machine. A shell gives you access to the
machine's daemons. Each daemon is a service that you can call. Some machines
also have a ghost. When you connect to a machine that has a ghost, the ghost
takes over the shell. The ghost will select daemons, generate input for them,
and process the output.

You can find the implmementation of this process in [exec.ts](exec.ts).

# Machine

You can think of a machine as a bucket for ghosts, demons, and memory. You
interact with a machine via a shell.

### Bastion

When you connect to a machine, the machine calls its bastion and passes the
bastion your current shell. If the bastion returns null, the connection fails.
Otherwise, the connection returns a shell and the value of the bastion is used
to initialize the shell's session.

You can think of the machine's bastion kind of like middleware.

# Ghost

You can think of a ghost as an automator. Ghosts are concerned with iterating,
looping, linking daemons, generating feedback, and so on. Ghosts do not
typically do anything useful alone.

# Daemon

A daemon is a service that you can call. Daemons are the things that do useful
work. Daemons are typically stateless, but they can have state. Some daemons do
useful things by connecting to the network. If a daemon connects to the network,
the machine on the other end of the connection might have a ghost.

# Example

TODO

# Learn

Given a question, what are the kinds of follow-up questions that we can ask?

- disambiguation of terms
- clarification about the asker
- disambiguation of answer (what kind of answer are you looking for?)

Give a question, do some analysis on it. What kind of analysis could we do?

- decide what are the follow up questions
- decide what are the topics
- decide what are the sub-questions
- decide what is the key question
- rephrase the question
- generate some relevant questions
-
