/* ****************************************************************************
 *
 * ANALYSIS
 *
 * ****************************************************************************/

export type Synthetic = {
  parent?: undefined;
  children: (Hybrid | Analytic)[];
  value: string;
};

export type Hybrid = {
  parent: Synthetic | Hybrid;
  children: (Hybrid | Analytic)[];
  value: Synthetic;
};

export type Analytic = {
  parent: Synthetic | Hybrid;
  children?: undefined;
  value: Synthesizer;
};

export type Analysis = Synthetic | Hybrid | Analytic;

export type Analyzer = {
  type: "analyzer";
  analyze: (synthetic: Synthetic, synthesizers: Synthesizer[]) => Analysis;
};

export type Synthesizer = {
  type: "synthesizer";
  synthesize: (prompt: string) => string;
};

export type Trajectory = {
  parent?: Trajectory;
  children: Trajectory[];
  value: {
    analytic: Analytic;
    effect: string;
  };
};

export type Engine = {
  type: "engine";
  exec: (synthetic: Synthetic) => Trajectory;
};

/* ****************************************************************************
 *
 * SESSION
 *
 * ****************************************************************************/

// MEMORY
// INSTRUCTIONS
// TOOLS
// FEEDBACK
// REFLECTION
// RETRY
// GUARDRAILS

export type Stage1 = {
  prompt: string;
  command?: undefined;
  params?: undefined;
  output?: undefined;
};

export type Stage2 = {
  prompt: string;
  command: string;
  params?: undefined;
  output?: undefined;
};

export type Stage3 = {
  prompt: string;
  command: string;
  params: string[];
  output?: undefined;
};

export type Stage4 = {
  prompt: string;
  command: string;
  params: string[];
  output: string;
};

export type Session = {
  init: string;
  tail: Stage4[];
  head: Stage1 | Stage2 | Stage3;
};

/* ****************************************************************************
 *
 * NEURAL SHELL
 *
 * ****************************************************************************/

/* A ghost is a thing that can call daemons. */
export type Ghost = {
  name: string;
};

/* A Daemon is a functional interface that can be called by an LLM */
export type Daemon = {
  name: string;
  function: string;
  inputs: string;
  outputs: string;
  exec: (inputs: string) => Promise<string>;
};

export type Bastion = {
  name: string;
};

export type Memory = string[];

export type Machine = {
  type: "analyzer" | "synthesizer" | "engine";
  function: string;
  ghost?: Ghost;
  bastion: Bastion;
  daemons: Daemon[];
  memory: Memory;
};
