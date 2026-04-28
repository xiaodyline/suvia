export type CheckpointType = "none" | "memory" | "sqlite";

export type CheckpointerConfig = {
  enabled: boolean;
  type: CheckpointType;
  sqlitePath: string;
};
