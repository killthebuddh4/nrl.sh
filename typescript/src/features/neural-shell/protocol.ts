export type Machine = {
  bastion?: Bastion;
  ghost?: Ghost;
  daemons: Daemon[];
  connect: ({
    fromShell,
  }: {
    fromShell?: Shell;
  }) => Promise<{ shell: Shell } | null>;
};

export type Bastion = ({ shell }: { shell: Shell }) => Log[] | null;

export type Ghost = {
  name: string;
  function: string;
  exec: Exec;
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
  exec: Exec;
};

export type Shell = {
  parent?: Shell;
  children: Shell[];

  ghost?: Ghost;
  daemons: Daemon[];

  session: Log[];

  exec: Exec;
};

export type Log = {
  daemon: string;
  outputs: { key: string; value: string }[];
};

export type Exec = ({ shell }: { shell: Shell }) => Promise<unknown>;
