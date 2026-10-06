import type {
  AnalysisMode,
  AnalysisResult,
  RiskLevel,
  SafetyAssessment,
  SafetyCategory,
} from "@/types/analysis";

type CategoryRule = {
  category: Exclude<SafetyCategory, "none">;
  pattern: RegExp;
  baseScore: number;
};

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "emergency",
    pattern:
      /\b(?:fire|smoke|weapon|gun|knife|unconscious|not breathing|severe bleeding|overdose|immediate danger|call 911|emergency)\b/i,
    baseScore: 3,
  },
  {
    category: "navigation",
    pattern:
      /\b(?:cross(?:ing)? (?:the )?(?:street|road)|traffic|oncoming|walk signal|intersection|train platform|platform edge|safe to (?:cross|walk|drive)|drive through)\b/i,
    baseScore: 3,
  },
  {
    category: "medication",
    pattern:
      /\b(?:medication|medicine|prescription|pill|tablet|capsule|dosage|dose|pharmacy|take (?:this|these|one|two)|inject|insulin)\b/i,
    baseScore: 2,
  },
  {
    category: "medical",
    pattern:
      /\b(?:diagnos(?:e|is)|symptom|rash|wound|infection|blood sugar|glucose|blood pressure|medical advice|treatment|allergic|poison)\b/i,
    baseScore: 2,
  },
  {
    category: "financial",
    pattern:
      /\b(?:bank account|routing number|credit card|debit card|wire transfer|send money|payment|financial advice|currency authentic|counterfeit|cash value)\b/i,
    baseScore: 2,
  },
  {
    category: "legal",
    pattern:
      /\b(?:legal advice|contract|court document|lawsuit|plea|sign (?:this|the)|binding agreement|will and testament)\b/i,
    baseScore: 2,
  },
  {
    category: "identity",
    pattern:
      /\b(?:who is (?:this|that|he|she|they)|identify (?:this |that )?person|recognize (?:this |that )?face|face recognition)\b/i,
    baseScore: 2,
  },
] as const;

const HIGH_STAKES_INTENT =
  /\b(?:should i|can i safely|is it safe|tell me (?:whether|if)|what (?:dose|dosage)|how much should|take|inject|diagnose|treat|sign|approve|transfer|send money|cross now|go now)\b/i;

const LEVEL_SCORE: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function levelForScore(score: number): RiskLevel {
  if (score >= 3) return "critical";
  if (score >= 2) return "high";
  if (score >= 1) return "medium";
  return "low";
}

function guidanceFor(level: RiskLevel, categories: SafetyCategory[]): string {
  if (level === "critical") {
    if (categories.includes("emergency")) {
      return "Do not rely on this image analysis. Move to safety if you can and contact local emergency services or a trusted person now.";
    }
    return "Do not act on this image alone. Stop, move away from immediate hazards, and confirm with a trusted person or qualified service.";
  }

  if (level === "high") {
    if (categories.includes("medication") || categories.includes("medical")) {
      return "Use this only as visual context. Confirm decisions with a pharmacist, clinician, caregiver, or the original accessible instructions.";
    }
    if (categories.includes("financial") || categories.includes("legal")) {
      return "Do not approve, sign, pay, or transfer based on this result. Verify with the issuing organization or a qualified person.";
    }
    if (categories.includes("identity")) {
      return "Do not use this result to identify a person or make a consequential decision. Ask the person directly or confirm another way.";
    }
    return "Do not act on this result until a trusted person or qualified service confirms it.";
  }

  if (level === "medium") {
    return "Treat this as visual assistance, not verification. Confirm important details before acting.";
  }

  return "Conditions can change and image analysis can be wrong. Use your usual accessibility tools and judgment.";
}

export interface AssessSafetyInput {
  mode: AnalysisMode;
  query?: string;
  modelText?: string;
  modelCategories?: SafetyCategory[];
}

export function assessSafety(input: AssessSafetyInput): SafetyAssessment {
  const query = input.query?.trim() ?? "";
  const allText = `${query}\n${input.modelText ?? ""}`;
  const categories = new Set<Exclude<SafetyCategory, "none">>();
  let score = 0;

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(allText)) {
      categories.add(rule.category);
      score = Math.max(score, rule.baseScore);
    }
  }

  for (const category of input.modelCategories ?? []) {
    if (category === "none") continue;
    categories.add(category);
    const modelScore =
      category === "emergency" ? 3 : category === "navigation" ? 2 : 1;
    score = Math.max(score, modelScore);
  }

  if (HIGH_STAKES_INTENT.test(query) && categories.size > 0) {
    score = Math.max(score, 2);
  }

  // A request to act in traffic is always critical, regardless of model wording.
  if (categories.has("navigation") && HIGH_STAKES_INTENT.test(query)) {
    score = 3;
  }

  const level = levelForScore(score);
  const normalizedCategories: SafetyCategory[] =
    categories.size > 0 ? [...categories] : ["none"];

  return {
    level,
    categories: normalizedCategories,
    safeToAct: LEVEL_SCORE[level] < LEVEL_SCORE.medium,
    requiresHumanConfirmation: LEVEL_SCORE[level] >= LEVEL_SCORE.medium,
    guidance: guidanceFor(level, normalizedCategories),
  };
}

export function enforceSafetyPolicy(result: AnalysisResult): AnalysisResult {
  if (result.safety.safeToAct) return result;

  const isImmediateHazard =
    result.safety.level === "critical" &&
    (result.safety.categories.includes("navigation") ||
      result.safety.categories.includes("emergency"));

  return {
    ...result,
    ...(isImmediateHazard
      ? {
          summary:
            "I cannot verify that this situation or action is safe from a single image.",
        }
      : {}),
    suggestedActions: [result.safety.guidance],
  };
}
