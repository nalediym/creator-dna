import { describe, it, expect } from "vitest";
import { InMemoryVectorTable } from "../semantic/store";
import { deterministicEmbedder } from "../semantic/embed";
import { kmeans } from "../semantic/k-means";

describe("InMemoryVectorTable", () => {
  it("upsert + lookup roundtrips a row", async () => {
    const table = new InMemoryVectorTable<{ tag: string }>();
    const v = new Float32Array([1, 0, 0, 0]);
    await table.upsert([{ id: "a", vector: v, meta: { tag: "alpha" } }]);
    const got = await table.lookup("a");
    expect(got).toBeDefined();
    expect(got!.meta.tag).toBe("alpha");
  });

  it("normalises vectors on upsert", async () => {
    const table = new InMemoryVectorTable<Record<string, never>>();
    await table.upsert([{ id: "a", vector: new Float32Array([3, 4]), meta: {} }]);
    const got = await table.lookup("a");
    // [3,4] L2-normalised → [0.6, 0.8]
    expect(got!.vector[0]).toBeCloseTo(0.6, 4);
    expect(got!.vector[1]).toBeCloseTo(0.8, 4);
  });

  it("search ranks by cosine similarity", async () => {
    const table = new InMemoryVectorTable<{ name: string }>();
    await table.upsert([
      { id: "x", vector: new Float32Array([1, 0]), meta: { name: "x" } },
      { id: "y", vector: new Float32Array([0.7, 0.7]), meta: { name: "y" } },
      { id: "z", vector: new Float32Array([0, 1]), meta: { name: "z" } },
    ]);
    const hits = await table.search(new Float32Array([1, 0])).limit(3);
    expect(hits.map((h) => h.meta.name)).toEqual(["x", "y", "z"]);
    expect(hits[0].score).toBeCloseTo(1, 4);
  });

  it("threshold filters out low-similarity rows", async () => {
    const table = new InMemoryVectorTable<{ name: string }>();
    await table.upsert([
      { id: "x", vector: new Float32Array([1, 0]), meta: { name: "x" } },
      { id: "z", vector: new Float32Array([0, 1]), meta: { name: "z" } },
    ]);
    const hits = await table.search(new Float32Array([1, 0])).threshold(0.5).limit(10);
    expect(hits).toHaveLength(1);
    expect(hits[0].meta.name).toBe("x");
  });

  it("filter narrows by meta predicate", async () => {
    const table = new InMemoryVectorTable<{ kind: string }>();
    await table.upsert([
      { id: "a", vector: new Float32Array([1, 0]), meta: { kind: "search" } },
      { id: "b", vector: new Float32Array([1, 0]), meta: { kind: "video" } },
    ]);
    const hits = await table
      .search(new Float32Array([1, 0]))
      .filter((m) => m.kind === "video")
      .limit(10);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("b");
  });
});

describe("deterministicEmbedder", () => {
  it("returns same vector for same input", async () => {
    const e = deterministicEmbedder(16);
    const [a] = await e.embed(["hello"]);
    const [b] = await e.embed(["hello"]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("different inputs produce different vectors", async () => {
    const e = deterministicEmbedder(16);
    const [a, b] = await e.embed(["hello", "world"]);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("output is L2-normalised", async () => {
    const e = deterministicEmbedder(16);
    const [v] = await e.embed(["test"]);
    let sumSq = 0;
    for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
    expect(sumSq).toBeCloseTo(1, 4);
  });

  it("dim matches what was requested", async () => {
    const e = deterministicEmbedder(64);
    expect(e.dim).toBe(64);
    const [v] = await e.embed(["x"]);
    expect(v.length).toBe(64);
  });
});

describe("kmeans", () => {
  it("clusters obviously-separable points", () => {
    // Two clusters: ~[1, 0] and ~[0, 1]
    const cluster1 = Array.from({ length: 5 }, (_, i) =>
      normalise(new Float32Array([1 + 0.01 * i, 0.01 * i])),
    );
    const cluster2 = Array.from({ length: 5 }, (_, i) =>
      normalise(new Float32Array([0.01 * i, 1 + 0.01 * i])),
    );
    const result = kmeans([...cluster1, ...cluster2], 2, { seed: 42 });
    // The first 5 should land in one cluster, the last 5 in the other.
    const firstHalf = new Set(result.assignments.slice(0, 5));
    const secondHalf = new Set(result.assignments.slice(5));
    expect(firstHalf.size).toBe(1);
    expect(secondHalf.size).toBe(1);
    expect([...firstHalf][0]).not.toBe([...secondHalf][0]);
  });

  it("is deterministic with a seed", () => {
    const vectors = Array.from({ length: 20 }, (_, i) =>
      normalise(new Float32Array([Math.sin(i), Math.cos(i)])),
    );
    const a = kmeans(vectors, 3, { seed: 7 });
    const b = kmeans(vectors, 3, { seed: 7 });
    expect(a.assignments).toEqual(b.assignments);
  });

  it("handles k >= n by returning each vector as its own cluster", () => {
    const v = [normalise(new Float32Array([1, 0])), normalise(new Float32Array([0, 1]))];
    const result = kmeans(v, 5);
    expect(result.assignments).toEqual([0, 1]);
    expect(result.centroids).toHaveLength(2);
  });
});

function normalise(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const n = Math.sqrt(sumSq);
  if (n > 0) for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}
