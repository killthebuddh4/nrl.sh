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
