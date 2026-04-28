import { logger } from "../../utils/logger.ts";
import { getSrsQualityConfig } from "./srs-quality.config.ts";
import { srsOptimizeService } from "./srs-optimize.service.ts";
import { srsReviewService } from "./srs-review.service.ts";
import {
  SrsQualityStopReason,
  type SrsOptimizeHistoryItem,
  type SrsQualityConfig,
  type SrsQualityPipelineResult,
  type SrsReviewResult,
} from "./srs-quality.types.ts";

const createHistoryItem = (
  round: number,
  review: SrsReviewResult,
  improvement: number | null
): SrsOptimizeHistoryItem => ({
  round,
  score: review.totalScore,
  improvement,
  review,
});

const createResult = ({
  document,
  enabled,
  config,
  stopReason,
  finalReview,
  history,
}: {
  document: string;
  enabled: boolean;
  config: SrsQualityConfig;
  stopReason: SrsQualityStopReason;
  finalReview?: SrsReviewResult;
  history: SrsOptimizeHistoryItem[];
}): SrsQualityPipelineResult => {
  const optimizeRounds = history.filter((item) => item.round > 0).length;

  logger.info("QUALITY", "SRS quality pipeline completed", {
    stopReason,
    finalScore: finalReview?.totalScore,
    rounds: optimizeRounds,
  });

  return {
    document,
    quality: {
      enabled,
      finalScore: finalReview?.totalScore,
      scoreThreshold: config.scoreThreshold,
      optimizeRounds,
      stopReason,
      finalReview,
      history,
    },
  };
};

export const runSrsQualityPipeline = async (
  initialDocument: string
): Promise<SrsQualityPipelineResult> => {
  const config = getSrsQualityConfig();

  if (!config.reviewEnabled) {
    return createResult({
      document: initialDocument,
      enabled: false,
      config,
      stopReason: SrsQualityStopReason.ReviewDisabled,
      history: [],
    });
  }

  let currentDocument = initialDocument;
  let currentReview: SrsReviewResult;

  try {
    currentReview = await srsReviewService.review(initialDocument);
  } catch {
    return createResult({
      document: initialDocument,
      enabled: true,
      config,
      stopReason: SrsQualityStopReason.ReviewFailed,
      history: [],
    });
  }

  let bestDocument = initialDocument;
  let bestReview = currentReview;
  const history: SrsOptimizeHistoryItem[] = [
    createHistoryItem(0, currentReview, null),
  ];

  if (currentReview.totalScore >= config.scoreThreshold) {
    return createResult({
      document: initialDocument,
      enabled: true,
      config,
      stopReason: SrsQualityStopReason.ScoreThresholdMet,
      finalReview: currentReview,
      history,
    });
  }

  if (!config.autoOptimizeEnabled) {
    return createResult({
      document: initialDocument,
      enabled: true,
      config,
      stopReason: SrsQualityStopReason.AutoOptimizeDisabled,
      finalReview: currentReview,
      history,
    });
  }

  if (config.maxOptimizeRounds === 0) {
    return createResult({
      document: initialDocument,
      enabled: true,
      config,
      stopReason: SrsQualityStopReason.MaxRoundsReached,
      finalReview: currentReview,
      history,
    });
  }

  for (let round = 1; round <= config.maxOptimizeRounds; round += 1) {
    let optimizedDocument: string;

    try {
      optimizedDocument = await srsOptimizeService.optimize({
        document: currentDocument,
        review: currentReview,
        round,
      });
    } catch {
      return createResult({
        document: bestDocument,
        enabled: true,
        config,
        stopReason: SrsQualityStopReason.OptimizeFailed,
        finalReview: bestReview,
        history,
      });
    }

    let optimizedReview: SrsReviewResult;

    try {
      optimizedReview = await srsReviewService.review(optimizedDocument);
    } catch {
      return createResult({
        document: bestDocument,
        enabled: true,
        config,
        stopReason: SrsQualityStopReason.ReviewFailed,
        finalReview: bestReview,
        history,
      });
    }

    const improvement = optimizedReview.totalScore - currentReview.totalScore;
    history.push(createHistoryItem(round, optimizedReview, improvement));

    if (optimizedReview.totalScore > bestReview.totalScore) {
      bestDocument = optimizedDocument;
      bestReview = optimizedReview;
    }

    if (optimizedReview.totalScore >= config.scoreThreshold) {
      return createResult({
        document: bestDocument,
        enabled: true,
        config,
        stopReason: SrsQualityStopReason.ScoreThresholdMet,
        finalReview: bestReview,
        history,
      });
    }

    if (optimizedReview.totalScore <= currentReview.totalScore) {
      return createResult({
        document: bestDocument,
        enabled: true,
        config,
        stopReason: SrsQualityStopReason.NoScoreImprovement,
        finalReview: bestReview,
        history,
      });
    }

    if (improvement < config.minScoreImprovement) {
      return createResult({
        document: bestDocument,
        enabled: true,
        config,
        stopReason: SrsQualityStopReason.ImprovementBelowMinimum,
        finalReview: bestReview,
        history,
      });
    }

    if (round === config.maxOptimizeRounds) {
      return createResult({
        document: bestDocument,
        enabled: true,
        config,
        stopReason: SrsQualityStopReason.MaxRoundsReached,
        finalReview: bestReview,
        history,
      });
    }

    currentDocument = optimizedDocument;
    currentReview = optimizedReview;
  }

  return createResult({
    document: bestDocument,
    enabled: true,
    config,
    stopReason: SrsQualityStopReason.MaxRoundsReached,
    finalReview: bestReview,
    history,
  });
};

export const srsQualityPipeline = {
  run: runSrsQualityPipeline,
};
