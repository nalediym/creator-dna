/**
 * POST /api/analyze — Vercel Function (Node runtime).
 *
 * Thin proxy to the Modal cloud-AI endpoint. Used as a fallback when the
 * browser doesn't have Chrome's on-device Gemini Nano. The browser is the
 * only thing that calls this — never anything else.
 *
 * Privacy boundary: this function receives only the ≤6KB CreatorDNASummary
 * the browser already aggregated (raw events stay in the browser).
 *
 * Env:
 *   MODAL_ANALYSIS_URL    — required
 *   MODAL_ANALYSIS_BEARER — optional bearer token forwarded as Authorization
 */

export const config = {
  runtime: "nodejs",
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const modalUrl = process.env.MODAL_ANALYSIS_URL;
  if (!modalUrl) {
    return Response.json(
      { error: "Fast cloud analysis is not configured." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (process.env.MODAL_ANALYSIS_BEARER) {
    headers.authorization = `Bearer ${process.env.MODAL_ANALYSIS_BEARER}`;
  }

  const upstream = await fetch(modalUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
