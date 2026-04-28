export type CheckpointType = "none" | "memory" | "sqlite" | "postgres";

export type CheckpointerConfig = {
  enabled: boolean;
  type: CheckpointType;
  sqlitePath: string;
  postgresUrl?: string;
};
