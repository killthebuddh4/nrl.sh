export class NoDataError extends Error {
  type: "no-data-error";
  public constructor(message: string) {
    super(message);
    this.type = "no-data-error";
  }
}

export class UnknownError extends Error {
  type: "unknown-error";
  public constructor() {
    super("unknown error");
    this.type = "unknown-error";
  }
}
