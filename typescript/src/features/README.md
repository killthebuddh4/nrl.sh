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