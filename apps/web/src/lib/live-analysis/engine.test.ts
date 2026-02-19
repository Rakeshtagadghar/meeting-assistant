import { describe, expect, it } from "vitest";
import { buildHeuristicLiveAnalysis } from "./engine";

describe("buildHeuristicLiveAnalysis", () => {
  it("computes baseline metrics, risks, and coaching output", () => {
    const result = buildHeuristicLiveAnalysis({
      meetingId: "meeting-1",
      sensitivity: 50,
      coachingAggressiveness: 40,
      chunks: [
        {
          id: "1",
          sequence: 1,
          tStartMs: 0,
          tEndMs: 2_000,
          speaker: "Speaker 1",
          text: "Thanks for joining. I want to understand your timeline and budget.",
          confidence: 0.9,
        },
        {
          id: "2",
          sequence: 2,
          tStartMs: 2_100,
          tEndMs: 5_000,
          speaker: "Speaker 2",
          text: "The price seems high and we might wait until next quarter.",
          confidence: 0.92,
        },
        {
          id: "3",
          sequence: 3,
          tStartMs: 5_100,
          tEndMs: 7_000,
          speaker: "Speaker 2",
          text: "Also security and integration are concerns for legal.",
          confidence: 0.88,
        },
      ],
    });

    expect(result.metrics.clientEngagement).toBeGreaterThan(0);
    expect(result.metrics.callHealth).toBeGreaterThanOrEqual(0);
    expect(result.metrics.callHealth).toBeLessThanOrEqual(100);
    expect(result.metrics.riskFlags).toContain("priceObjection");
    expect(result.metrics.riskFlags).toContain("timingObjection");
    expect(result.metrics.topicCoverage.checkedTopics.length).toBeGreaterThan(
      0,
    );
    expect(result.coach.nextBestSay.length).toBeGreaterThan(0);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("assigns roles from audio source hints when speakers are unlabeled", () => {
    const result = buildHeuristicLiveAnalysis({
      meetingId: "meeting-2",
      sensitivity: 50,
      coachingAggressiveness: 50,
      chunks: [
        {
          id: "a1",
          sequence: 1,
          tStartMs: 0,
          tEndMs: 2_000,
          speaker: null,
          audioSource: "microphone",
          text: "Let me walk you through how we reduce onboarding time.",
          confidence: 0.9,
        },
        {
          id: "a2",
          sequence: 2,
          tStartMs: 2_100,
          tEndMs: 4_800,
          speaker: null,
          audioSource: "systemAudio",
          text: "We are worried about migration risk and implementation effort.",
          confidence: 0.9,
        },
      ],
    });

    expect(result.metrics.talkDynamics.talkRatioSalesPct).toBeGreaterThan(0);
    expect(result.metrics.talkDynamics.talkRatioClientPct).toBeGreaterThan(0);
    expect(result.metrics.riskFlags).toContain("integrationConcern");
  });

  it("emits champion and skeptic insights for multi-speaker client signals", () => {
    const result = buildHeuristicLiveAnalysis({
      meetingId: "meeting-3",
      sensitivity: 50,
      coachingAggressiveness: 70,
      chunks: [
        {
          id: "b1",
          sequence: 1,
          tStartMs: 0,
          tEndMs: 1_500,
          speaker: "Sales Rep",
          speakerRole: "SALES",
          text: "Thanks both. What matters most for this rollout?",
          confidence: 0.95,
        },
        {
          id: "b2",
          sequence: 2,
          tStartMs: 1_600,
          tEndMs: 4_000,
          speaker: "Champion",
          speakerRole: "CLIENT",
          text: "This looks great. It would help our team and the workflow is clear.",
          confidence: 0.92,
        },
        {
          id: "b3",
          sequence: 3,
          tStartMs: 4_100,
          tEndMs: 7_000,
          speaker: "Skeptic",
          speakerRole: "CLIENT",
          text: "The price is expensive and integration risk is a concern for us.",
          confidence: 0.9,
        },
      ],
    });

    const titles = result.insights.map((item) => item.title);
    expect(titles).toContain("Potential champion identified");
    expect(titles).toContain("Potential skeptic identified");
    expect(result.coach.nextQuestions.length).toBeGreaterThan(0);
  });

  it("applies prosody tone-weight disable and confidence penalty from chunk metadata", () => {
    const baseChunks = [
      {
        id: "p1",
        sequence: 1,
        tStartMs: 0,
        tEndMs: 1_300,
        speaker: "Rep",
        speakerRole: "SALES" as const,
        text: "Could you share how the team feels about current workflows?",
        confidence: 0.95,
      },
      {
        id: "p2",
        sequence: 2,
        tStartMs: 1_500,
        tEndMs: 4_200,
        speaker: "Buyer",
        speakerRole: "CLIENT" as const,
        text: "The process is okay and we are exploring options.",
        confidence: 0.9,
        prosodyEnergy: 0.65,
        prosodyPauseRatio: 0.2,
        prosodyVoicedMs: 1_200,
        prosodySnrDb: 16,
      },
      {
        id: "p3",
        sequence: 3,
        tStartMs: 4_400,
        tEndMs: 6_900,
        speaker: "Buyer",
        speakerRole: "CLIENT" as const,
        text: "If rollout is simple we can move quickly.",
        confidence: 0.9,
        prosodyEnergy: 0.7,
        prosodyPauseRatio: 0.18,
        prosodyVoicedMs: 1_400,
        prosodySnrDb: 17,
      },
    ];

    const toneEnabled = buildHeuristicLiveAnalysis({
      meetingId: "meeting-4",
      sensitivity: 50,
      coachingAggressiveness: 40,
      chunks: baseChunks.map((chunk) =>
        chunk.speakerRole === "CLIENT"
          ? {
              ...chunk,
              prosodyQualityPass: true,
              prosodyToneWeightsEnabled: true,
              prosodyConfidencePenalty: 0,
              prosodyClientEnergy: 0.82,
              prosodyClientStress: 0.22,
              prosodyClientCertainty: 0.86,
            }
          : chunk,
      ),
    });

    const toneDisabled = buildHeuristicLiveAnalysis({
      meetingId: "meeting-4",
      sensitivity: 50,
      coachingAggressiveness: 40,
      chunks: baseChunks.map((chunk) =>
        chunk.speakerRole === "CLIENT"
          ? {
              ...chunk,
              prosodyQualityPass: false,
              prosodyToneWeightsEnabled: false,
              prosodyConfidencePenalty: 0.2,
              prosodyClientEnergy: 0.82,
              prosodyClientStress: 0.22,
              prosodyClientCertainty: 0.86,
            }
          : chunk,
      ),
    });

    expect(toneEnabled.metrics.toneConfidence ?? 0).toBeGreaterThan(
      toneDisabled.metrics.toneConfidence ?? 0,
    );
    expect(toneEnabled.metrics.clientEngagement).toBeGreaterThan(
      toneDisabled.metrics.clientEngagement,
    );
    expect(toneDisabled.metrics.clientEngagementConfidence).toBeLessThan(
      toneEnabled.metrics.clientEngagementConfidence,
    );
  });
});
