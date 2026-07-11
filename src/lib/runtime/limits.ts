export const RUN_LIMITS = {
  promptCharacters: 1_200,
  purposeCharacters: 600,
  contextNodes: 80,
  contextEdges: 120,
  proposalsPerBatch: 8,
  nodeBudget: 120,
  edgeBudget: 480,
  localDelayMs: 280,
} as const;
