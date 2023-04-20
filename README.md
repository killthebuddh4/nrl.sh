# Components Overview

[Architecture Diagrams](https://www.figma.com/file/pdRAghHSin9dkI9h9RnwGL/Relay-Robot-Architecture?node-id=0-1&t=AKMk5dPdqlf0JvKj-0)

## Agent Framework

Prompting Techniques:

- ReAct (input -> thought -> action -> observation -> repeat)
- Reflexion (ReAct -> heuristic -> reflect -> repeat)
- Self-Refine (output -> feedback -> refine -> test -> repeat)
- Self-Ask (TODO)
- Some kind of retrieval technique
- Some kind of memory technique

Agents:

- plato (controller)
- socrates (analysis)
- demon (introspection)
- diotima (synthesis)
- pythia (oracle)

## Human-in-the-Loop Framework

* discord bot (realtime conversation UI)
* trajectory UI (a more detailed view of trajectories, for when Discord is not enough)
* evaluations (run evaluations on a set of trajectories)

### Trajectory UI

3 Views:

* search (overview) -- query, analyze, filter trajectories
* trajectory (graph view) -- visualize and interact with a trajectories nodes
* conversation (linear view) -- visualize a trajectory as a user would (as a linear conversation)

### Discord Bot

TODO

## Backend

* adapters -- bridge messaging networks to the agent framework.
* HTTP API -- the core robot logic
* database -- self-explanatory
* batch jobs -- index, analyze, etc.

# Project Overview

TODO

# Development Roadmap

**v0.0.1**

* Agent Framework
  - pythia
  - diotima
  - demon
  - socrates
* Trajectory UI
  - list all root trajectories
  - select a trajectory
  - create new trajectory
  - visualize a single trajectory
  - select a trajectory node
  - take action on selected node
* Evaluations
  - TODO

**v0.0.1 Log**

2023-04-20

- Achilles is working on authoring the "Pythia" agent. 
- "Pythia" can answer questions that require access to a web browser. 
- Pythia will traverse websites intelligently and extract information from them.
- Andrew is working on a function to evaluate the quality of a question/answer pair.


