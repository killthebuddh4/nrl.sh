export type Machine = {
  ghost?: Ghost;
  daemons: Daemon[];
  connect: ({ fromShell }: { fromShell?: Shell }) => Promise<{ shell: Shell }>;
};

export type Ghost = {
  name: string;
  function: string;
  exec: ({ shell }: { shell: Shell }) => Promise<void>;
};

export type Daemon = {
  name: string;
  function: string;
  inputs: {
    key: string;
    description: string;
  }[];
  outputs: {
    key: string;
    description: string;
  }[];
  exec: ({ shell }: { shell: Shell }) => Promise<void>;
};

export type Shell = {
  parent?: Shell;
  children: Shell[];

  machine: Machine;

  session: Log[];
};

export type Log = {
  daemon: string;
  outputs: { key: string; value: string }[];
};
