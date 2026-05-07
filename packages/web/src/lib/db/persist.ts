/**
 * Persist adapter: writes ingestor output to Dexie.
 *
 * Idempotent on Run.source_hash. Same export uploaded twice → returns the
 * existing run_id and writes nothing. The pipeline can use this to skip
 * re-embedding / re-scoring on a refresh.
 *
 * Edges merge: if an edge with the same (source_id, edge_type, target_id)
 * already exists, we increment weight + evidence_count and widen the
 * first_seen / last_seen window instead of inserting a duplicate.
 */

import type { IngestResult } from "@creator-dna/core";
import { getDb, type EdgeRow, type EntityRow, type EventRow, type RunRow } from "./schema";

export interface PersistResult {
  run_id: number;
  /** True if this hash had already been ingested — nothing was written. */
  skipped: boolean;
  summary: RunRow["summary"];
}

export async function persistIngest(result: IngestResult): Promise<PersistResult> {
  const db = getDb();
  if (!db) throw new Error("persistIngest requires IndexedDB (browser only)");

  // 1. Hash check — skip if we've already ingested this exact export.
  const existing = await db.runs.where("source_hash").equals(result.source_hash).first();
  if (existing && existing.id !== undefined) {
    return {
      run_id: existing.id,
      skipped: true,
      summary: existing.summary,
    };
  }

  let runId = 0;
  await db.transaction("rw", db.events, db.entities, db.edges, db.runs, async () => {
    // 2. Insert run row first so subsequent rows can reference run_id when needed.
    runId = (await db.runs.add({
      ts: new Date().toISOString(),
      source_hash: result.source_hash,
      summary: {
        events: result.events.length,
        entities: result.entities.length,
        edges: result.edges.length,
      },
    } as RunRow)) as number;

    // 3. Events: append-only, bulk add.
    if (result.events.length > 0) {
      await db.events.bulkAdd(result.events as EventRow[]);
    }

    // 4. Entities: upsert by id (last-write-wins on attrs merge handled in ingestor).
    if (result.entities.length > 0) {
      await db.entities.bulkPut(result.entities as EntityRow[]);
    }

    // 5. Edges: merge with existing rows on (source_id, edge_type, target_id).
    // Strategy: index lookup per edge. For our scale (≤100k edges, mostly first-time
    // inserts), this is fast enough. Optimise later if profiling says otherwise.
    for (const edge of result.edges) {
      const existing = await db.edges
        .where("[source_id+edge_type]")
        .equals([edge.source_id, edge.edge_type])
        .filter((e) => e.target_id === edge.target_id)
        .first();
      if (existing && existing.id !== undefined) {
        const merged: EdgeRow = {
          ...existing,
          weight: existing.weight + edge.weight,
          evidence_count: existing.evidence_count + edge.evidence_count,
          first_seen:
            existing.first_seen && edge.first_seen
              ? existing.first_seen < edge.first_seen
                ? existing.first_seen
                : edge.first_seen
              : existing.first_seen ?? edge.first_seen,
          last_seen:
            existing.last_seen && edge.last_seen
              ? existing.last_seen > edge.last_seen
                ? existing.last_seen
                : edge.last_seen
              : existing.last_seen ?? edge.last_seen,
          attrs: { ...(existing.attrs ?? {}), ...(edge.attrs ?? {}) },
        };
        await db.edges.put(merged);
      } else {
        await db.edges.add(edge as EdgeRow);
      }
    }
  });

  return {
    run_id: runId,
    skipped: false,
    summary: {
      events: result.events.length,
      entities: result.entities.length,
      edges: result.edges.length,
    },
  };
}
