/**
 * Candidate scoring and matching logic.
 * Ranks nutrition candidates from multiple providers
 * based on name similarity, brand match, and data completeness.
 */

import type { NutritionCandidate } from "./types";

/**
 * Simple string similarity (Dice coefficient on bigrams).
 */
function bigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

function diceCoefficient(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Check if key words from query appear in the candidate name.
 */
function keywordOverlap(query: string, candidateName: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const candidateWords = new Set(candidateName.toLowerCase().split(/\s+/));

  if (queryWords.length === 0) return 0;
  let matches = 0;
  for (const word of queryWords) {
    for (const cw of candidateWords) {
      if (cw.includes(word) || word.includes(cw)) {
        matches++;
        break;
      }
    }
  }
  return matches / queryWords.length;
}

/**
 * Score a candidate's data completeness (0-1).
 */
function completenessScore(candidate: NutritionCandidate): number {
  const fields = [
    candidate.caloriesPer100g,
    candidate.proteinPer100g,
    candidate.fatPer100g,
    candidate.carbsPer100g,
  ];
  const filled = fields.filter((f) => f != null && f > 0).length;
  return filled / fields.length;
}

export interface MatchResult {
  candidate: NutritionCandidate;
  finalScore: number;
  nameSimilarity: number;
  keywordMatch: number;
  brandMatch: boolean;
  completeness: number;
}

/**
 * Score and rank candidates against the query.
 */
export function rankCandidates(
  query: string,
  brand: string | null,
  candidates: NutritionCandidate[]
): MatchResult[] {
  if (candidates.length === 0) return [];

  const results: MatchResult[] = candidates.map((candidate) => {
    // Name similarity (40% weight)
    const nameSim = diceCoefficient(query, candidate.name);

    // Keyword overlap (25% weight)
    const keyMatch = keywordOverlap(query, candidate.name);

    // Brand match (15% weight)
    const brandMatch =
      brand && candidate.brand
        ? candidate.brand.toLowerCase().includes(brand.toLowerCase()) ||
          brand.toLowerCase().includes(candidate.brand.toLowerCase())
        : false;

    // Data completeness (10% weight)
    const completeness = completenessScore(candidate);

    // Provider score from search order (10% weight)
    const providerScore = candidate.score;

    const finalScore =
      nameSim * 0.4 +
      keyMatch * 0.25 +
      (brandMatch ? 0.15 : 0) +
      completeness * 0.1 +
      providerScore * 0.1;

    return {
      candidate,
      finalScore: Math.min(1, finalScore),
      nameSimilarity: nameSim,
      keywordMatch: keyMatch,
      brandMatch,
      completeness,
    };
  });

  // Sort by final score descending
  results.sort((a, b) => b.finalScore - a.finalScore);

  return results;
}

/**
 * Minimum score threshold to auto-accept a match.
 */
export const AUTO_ACCEPT_THRESHOLD = 0.6;

/**
 * Below this, suggest manual review.
 */
export const REVIEW_THRESHOLD = 0.35;
