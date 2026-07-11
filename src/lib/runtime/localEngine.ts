import type {
  GenerationContextEdge,
  GenerationContextNode,
  MutationProposal,
  NodeKind,
  RelationKind,
} from "@/lib/domain/types";
import { RUN_LIMITS } from "@/lib/runtime/limits";

const STOP_WORDS = new Set([
  "about",
  "after",
  "agent",
  "allow",
  "build",
  "from",
  "graph",
  "into",
  "that",
  "their",
  "them",
  "this",
  "through",
  "with",
]);

export interface LocalEngineInput {
  prompt: string;
  purpose: string;
  batch: number;
  existingNodes: GenerationContextNode[];
  existingEdges: GenerationContextEdge[];
  signal?: AbortSignal;
  delayMs?: number;
}

function abortError(): DOMException {
  return new DOMException("The run was stopped.", "AbortError");
}

async function pause(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();
  if (milliseconds <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    setTimeout(() => signal?.removeEventListener("abort", onAbort), milliseconds);
  });
}

function wordsFrom(input: LocalEngineInput): string[] {
  const words = `${input.prompt} ${input.purpose}`
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+/gu);
  const unique = [...new Set(words ?? [])].filter(
    (word) => word.length >= 4 && !STOP_WORDS.has(word),
  );
  return unique.length >= 3 ? unique.slice(0, 12) : ["context", "evidence", "state"];
}

function title(word: string): string {
  return `${word.charAt(0).toLocaleUpperCase("en-US")}${word.slice(1)}`;
}

function slug(word: string): string {
  return word.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

async function* paced(
  proposals: Iterable<MutationProposal>,
  delayMs: number,
  signal?: AbortSignal,
): AsyncGenerator<MutationProposal> {
  for (const proposal of proposals) {
    if (signal?.aborted) throw abortError();
    yield proposal;
    await pause(delayMs, signal);
  }
}

export async function* generateLocalProposals(
  input: LocalEngineInput,
): AsyncGenerator<MutationProposal> {
  const delayMs = input.delayMs ?? RUN_LIMITS.localDelayMs;
  const existingByLabel = new Map(
    input.existingNodes.map((node) => [node.label.toLocaleLowerCase("en-US"), node.id]),
  );
  const opening: MutationProposal[] = [];
  const seedExisting = existingByLabel.get("seed prompt");
  const seedRef = seedExisting ?? "batch:seed-prompt";

  if (!seedExisting) {
    opening.push({
      type: "add-node",
      ref: "seed-prompt",
      label: "Seed prompt",
      summary: input.prompt,
      kind: "source",
      epistemicStatus: "observed",
      confidence: 1,
      evidence: [],
      reason: "The user supplied this prompt as the run source.",
    });
  }

  const purposeExisting = existingByLabel.get("project purpose");
  const purposeRef = purposeExisting ?? "batch:project-purpose";
  if (!purposeExisting) {
    opening.push({
      type: "add-node",
      ref: "project-purpose",
      label: "Project purpose",
      summary: input.purpose,
      kind: "decision",
      epistemicStatus: "asserted",
      confidence: 1,
      evidence: [],
      reason: "The user stated this purpose when creating the project.",
    });
    opening.push({
      type: "add-edge",
      sourceRef: purposeRef,
      targetRef: seedRef,
      relation: "derived-from",
      confidence: 1,
      evidence: [],
      reason: "The stated purpose frames how the seed prompt is interpreted.",
    });
  }

  const anchors: string[] = [seedRef, purposeRef];
  const words = wordsFrom(input);
  for (const [index, word] of words.entries()) {
    const label = title(word);
    const existing = existingByLabel.get(label.toLocaleLowerCase("en-US"));
    const ref = existing ?? `batch:concept-${slug(word)}-${index}`;
    anchors.push(ref);
    if (existing) continue;
    opening.push({
      type: "add-node",
      ref: `concept-${slug(word)}-${index}`,
      label,
      summary: `A term extracted deterministically from the seed prompt and purpose: ${word}.`,
      kind: "concept",
      epistemicStatus: "inferred",
      confidence: 0.55,
      evidence: [],
      reason: `The local engine found the repeated content term ${word}.`,
    });
    opening.push({
      type: "add-edge",
      sourceRef: ref,
      targetRef: seedRef,
      relation: "derived-from",
      confidence: 0.55,
      evidence: [],
      reason: "The concept was extracted from the user's seed prompt.",
    });
  }

  yield* paced(opening, delayMs, input.signal);

  const kinds: NodeKind[] = ["question", "assertion", "state", "observation"];
  const relations: RelationKind[] = [
    "depends-on",
    "supports",
    "transitions-to",
    "derived-from",
  ];
  let round = input.existingNodes.length + input.batch * 100;

  while (true) {
    if (input.signal?.aborted) throw abortError();
    const word = words[round % words.length];
    const nextWord = words[(round + 1) % words.length];
    const kind = kinds[round % kinds.length];
    const relation = relations[round % relations.length];
    const ref = `expansion-${round}`;
    const label =
      kind === "question"
        ? `How do ${title(word)} and ${title(nextWord)} connect?`
        : `${title(word)} ${kind} ${round + 1}`;

    yield* paced(
      [
        {
          type: "add-node",
          ref,
          label,
          summary: `A deterministic ${kind} that extends the local graph around ${word} and ${nextWord}.`,
          kind,
          epistemicStatus: kind === "observation" ? "observed" : "hypothesis",
          confidence: kind === "observation" ? 0.4 : 0.45,
          evidence: [],
          reason: "The local engine expands one pair of extracted concepts per cycle.",
        },
        {
          type: "add-edge",
          sourceRef: `batch:${ref}`,
          targetRef: anchors[round % anchors.length],
          relation,
          confidence: 0.45,
          evidence: [],
          reason: `The expansion is attached through the explicit ${relation} relation.`,
        },
      ],
      delayMs,
      input.signal,
    );
    round += 1;
  }
}
