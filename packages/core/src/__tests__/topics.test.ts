import { describe, it, expect } from "vitest";
import { ingest } from "../graph/ingest";
import { deriveTopics } from "../graph/topics";
import { entityId } from "../graph/schema";
import { InMemoryGraphStorage } from "../graph/storage";
import { deterministicEmbedder } from "../semantic/embed";
import type { ParsedExport } from "../types";

function makeParsed(overrides: Partial<ParsedExport> = {}): ParsedExport {
  return {
    sections: {
      watchHistory: true,
      likes: true,
      favorites: true,
      searches: true,
      shares: true,
      following: true,
    },
    watchHistory: [],
    likes: [],
    favorites: [],
    searches: [],
    shares: [],
    following: [],
    ...overrides,
  };
}

describe("deriveTopics", () => {
  it("skips when corpus is too small", async () => {
    const ingested = ingest(
      makeParsed({
        searches: [{ date: "2025-01-01 10:00:00", term: "makeup" }],
      }),
    );
    const storage = new InMemoryGraphStorage(ingested.entities, ingested.edges);
    const result = await deriveTopics(storage, deterministicEmbedder(32), {
      k: 5,
      minCorpus: 10,
    });
    expect(result.skipped).toBe(true);
    expect(result.topics).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("produces the requested number of topics + ABOUT edges per source", async () => {
    const searches = Array.from({ length: 20 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")} 10:00:00`,
      term: `query-${i}`,
    }));
    const ingested = ingest(makeParsed({ searches }));
    const storage = new InMemoryGraphStorage(ingested.entities, ingested.edges);

    const result = await deriveTopics(storage, deterministicEmbedder(32), {
      k: 4,
      seed: 7,
    });

    expect(result.skipped).toBe(false);
    expect(result.topics).toHaveLength(4);
    expect(result.edges).toHaveLength(20); // one ABOUT edge per source

    // Every edge points at one of the produced topics.
    const topicIds = new Set(result.topics.map((t) => t.id));
    for (const e of result.edges) {
      expect(e.edge_type).toBe("ABOUT");
      expect(topicIds.has(e.target_id)).toBe(true);
    }

    // Topic sizes sum to the source count.
    const totalAssigned = result.topicSizes.reduce((a, b) => a + b, 0);
    expect(totalAssigned).toBe(20);
  });

  it("produces stable topic ids across runs (same seed)", async () => {
    const searches = Array.from({ length: 16 }, (_, i) => ({
      date: `2025-02-${String(i + 1).padStart(2, "0")} 10:00:00`,
      term: `topic-source-${i}`,
    }));
    const ingested = ingest(makeParsed({ searches }));
    const storage = new InMemoryGraphStorage(ingested.entities, ingested.edges);

    const a = await deriveTopics(storage, deterministicEmbedder(32), { k: 3, seed: 42 });
    const b = await deriveTopics(storage, deterministicEmbedder(32), { k: 3, seed: 42 });

    const idsA = a.topics.map((t) => t.id).sort();
    const idsB = b.topics.map((t) => t.id).sort();
    expect(idsA).toEqual(idsB);
  });

  it("clamps k when corpus is small (k can't exceed sources/2)", async () => {
    const searches = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-03-${String(i + 1).padStart(2, "0")} 10:00:00`,
      term: `q${i}`,
    }));
    const ingested = ingest(makeParsed({ searches }));
    const storage = new InMemoryGraphStorage(ingested.entities, ingested.edges);

    const result = await deriveTopics(storage, deterministicEmbedder(32), {
      k: 100, // way too big
      seed: 1,
    });
    // 10 sources, k clamped to floor(10/2) = 5
    expect(result.topics.length).toBeLessThanOrEqual(5);
    expect(result.topics.length).toBeGreaterThan(0);
  });

  it("each ABOUT edge sources from a Search entity that exists in the graph", async () => {
    const searches = Array.from({ length: 12 }, (_, i) => ({
      date: `2025-04-${String(i + 1).padStart(2, "0")} 10:00:00`,
      term: `term-${i}`,
    }));
    const ingested = ingest(makeParsed({ searches }));
    const storage = new InMemoryGraphStorage(ingested.entities, ingested.edges);

    const result = await deriveTopics(storage, deterministicEmbedder(32), { k: 3, seed: 1 });

    const expectedSearchIds = new Set(searches.map((s) => entityId.search(s.term)));
    const actualSourceIds = new Set(result.edges.map((e) => e.source_id));
    for (const id of actualSourceIds) {
      expect(expectedSearchIds.has(id)).toBe(true);
    }
  });
});
