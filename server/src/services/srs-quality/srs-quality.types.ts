export type SrsReviewDimension = {
  name: string;
  score: number;
  maxScore: number;
  comments: string;
};

export type SrsReviewResult = {
  totalScore: number;
  dimensions: SrsReviewDimension[];
  problems: string[];
  suggestions: string[];
  summary: string;
};

export type SrsQualityConfig = {
  reviewEnabled: boolean;
  autoOptimizeEnabled: boolean;
  scoreThreshold: number;
  maxOptimizeRounds: number;
  minScoreImprovement: number;
};

export enum SrsQualityStopReason {
  ReviewDisabled = "review_disabled",
  ScoreThresholdMet = "score_threshold_met",
  AutoOptimizeDisabled = "auto_optimize_disabled",
  MaxRoundsReached = "max_rounds_reached",
  NoScoreImprovement = "no_score_improvement",
  ImprovementBelowMinimum = "improvement_below_minimum",
  ReviewFailed = "review_failed",
  OptimizeFailed = "optimize_failed",
}

export type SrsOptimizeHistoryItem = {
  round: number;
  score: number;
  improvement: number | null;
  review: SrsReviewResult;
};

export type SrsQualityResult = {
  enabled: boolean;
  finalScore?: number;
  scoreThreshold: number;
  optimizeRounds: number;
  stopReason: SrsQualityStopReason;
  finalReview?: SrsReviewResult;
  history: SrsOptimizeHistoryItem[];
};

export type SrsQualityPipelineResult = {
  document: string;
  quality: SrsQualityResult;
};
