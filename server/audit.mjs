// Proof auditor.
//
// The receipt is the record; this module decides whether the artifact behind it
// actually satisfies the obligation. Two engines, same interface:
//   - gemini: structured output, used when GEMINI_API_KEY is set
//   - deterministic: local heuristics, used in tests and when no key is set
//
// A provider failure falls back to the deterministic engine and says so, so a
// network hiccup never silently approves a payout.

const MIN_CONFIDENCE = 0.8;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verified: { type: "boolean" },
    confidence: { type: "number" },
    extracted_entities: {
      type: "object",
      properties: {
        document_type: { type: "string" },
        confirmation_number: { type: "string" },
        amount_detected: { type: "number" },
        date_detected: { type: "string" },
      },
    },
    matching_verdict: { type: "string" },
    discrepancies: { type: "array", items: { type: "string" } },
  },
  required: ["verified", "confidence", "matching_verdict", "discrepancies"],
};

export function auditorConfigured(env = process.env) {
  return Boolean(env.GEMINI_API_KEY);
}

export function auditThreshold(env = process.env) {
  const raw = Number(env.AUDIT_MIN_CONFIDENCE ?? MIN_CONFIDENCE);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : MIN_CONFIDENCE;
}

/**
 * Decide whether an artifact proves the obligation was done.
 * Always resolves: a rejected result carries the reasons the payer can act on.
 */
export async function auditEvidence({ obligation, artifact, receipt, env = process.env } = {}) {
  const text = String(artifact?.text || "").trim();
  const inline = inlineMedia(artifact);
  const threshold = auditThreshold(env);

  if (!text && !inline) {
    return {
      verified: false,
      confidence: 0,
      engine: "none",
      extracted: {},
      verdict: "No proof artifact was attached. Nothing can be verified without one.",
      discrepancies: ["The proof artifact is empty."],
    };
  }

  if (auditorConfigured(env)) {
    try {
      return await auditWithGemini({ obligation, artifact, text, inline, env, threshold });
    } catch (error) {
      return {
        ...auditDeterministic({ obligation, artifact, text, threshold, inline }),
        engine: "deterministic_fallback",
        note: `The AI auditor was unavailable (${String(error?.message || error).slice(0, 120)}), so the local checks ran instead.`,
      };
    }
  }

  return auditDeterministic({ obligation, artifact, text, threshold, inline });
}

const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "application/pdf"]);

function inlineMedia(artifact) {
  const data = typeof artifact?.data === "string" ? artifact.data.trim() : "";
  if (!data) return null;
  const declared = String(artifact.mime || artifact.type || "").toLowerCase();
  const mime = INLINE_TYPES.has(declared)
    ? declared
    : String(artifact.name || "").toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/png";
  return { mime, data: data.slice(0, 900_000) };
}

async function auditWithGemini({ obligation, artifact, text, inline, env, threshold }) {
  const model = String(env.AI_MODEL_ID || "gemini-2.5-flash").trim();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "You verify proof of completion for a recurring obligation.",
                  "Return JSON only. Be strict: verified means the artifact actually demonstrates the requirement.",
                  inline ? "The attached file is the artifact. Read its text and visual content directly." : "",
                  "",
                  `Obligation: ${obligation.title}`,
                  `Provider: ${obligation.provider || "unknown"}`,
                  `Amount: ${obligation.amount || 0} ${obligation.currency || "USD"}`,
                  `Requirement: ${obligation.proof_required || "Any receipt or confirmation"}`,
                  `Artifact name: ${artifact?.name || "proof"}`,
                  "",
                  "Artifact text:",
                  text.slice(0, 3500),
                ].filter(Boolean).join("\n"),
              },
              ...(inline ? [{ inline_data: { mime_type: inline.mime, data: inline.data } }] : []),
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!response.ok) {
    throw new Error(`auditor_${response.status}`);
  }
  const json = await response.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = JSON.parse(raw);

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const verified = parsed.verified === true && confidence >= threshold;
  const discrepancies = Array.isArray(parsed.discrepancies)
    ? parsed.discrepancies.map((entry) => String(entry)).slice(0, 8)
    : [];

  if (parsed.verified === true && confidence < threshold) {
    discrepancies.push(`Confidence ${Math.round(confidence * 100)}% is below the ${Math.round(threshold * 100)}% release threshold.`);
  }

  return {
    verified,
    confidence,
    engine: `gemini:${model}`,
    extracted: parsed.extracted_entities || {},
    verdict: String(parsed.matching_verdict || "").slice(0, 600),
    discrepancies,
  };
}

function auditDeterministic({ obligation, artifact, text, inline, threshold }) {
  if (inline && !text) {
    return {
      verified: false,
      confidence: 0,
      engine: "deterministic",
      extracted: {},
      verdict: "The artifact is an image or a scanned PDF. Only the AI auditor can read it, and no model key is configured, so nothing was released.",
      discrepancies: ["An image or scanned PDF needs the AI auditor (GEMINI_API_KEY)."],
    };
  }

  const haystack = text.toLowerCase();
  const discrepancies = [];
  let score = 0.45;

  const amount = Number(obligation.amount || 0);
  const amounts = findAmounts(text);
  const amountSeen = amount > 0 && amounts.some((value) => Math.abs(value - amount) < 0.005);
  if (amount > 0) {
    if (amountSeen) {
      score += 0.2;
    } else {
      discrepancies.push(`The artifact does not show the obligation amount ($${amount.toFixed(2)}).`);
      if (amounts.length) {
        discrepancies.push(
          `It shows ${amounts.map((value) => `$${value.toFixed(2)}`).join(", ")} instead — a different amount is a mismatch, not a missing detail.`
        );
      }
    }
  }

  const confirmation = text.match(/\b(?:confirmation|receipt|reference|invoice|transaction|order|certificate)\s*(?:no\.?|number|id|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,})/i);
  if (confirmation) score += 0.15;
  else discrepancies.push("No confirmation or reference number was found.");

  const date = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/) || text.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/) || text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/i);
  if (date) score += 0.1;
  else discrepancies.push("No date was found on the artifact.");

  const required = String(obligation.proof_required || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 5 && !STOPWORDS.has(word));
  const overlap = required.filter((word) => haystack.includes(word));
  if (required.length) {
    if (overlap.length >= Math.min(2, required.length)) score += 0.1;
    else discrepancies.push("The artifact does not describe the required proof in its own words.");
  }

  if (amount > 0 && !amountSeen && amounts.length) {
    // An artifact that names a different amount is a mismatch; it cannot be
    // rescued by having a reference number and a date.
    score = Math.min(score, 0.55);
  }

  if (artifact?.name && /\.(pdf|png|jpe?g)$/i.test(artifact.name)) score += 0.02;
  score = Math.min(0.99, Number(score.toFixed(2)));
  const verified = score >= threshold;

  return {
    verified,
    confidence: score,
    engine: "deterministic",
    extracted: {
      document_type: confirmation ? "confirmation" : "note",
      confirmation_number: confirmation?.[1] || null,
      amount_detected: amountSeen ? amount : null,
      date_detected: date?.[0] || null,
    },
    verdict: verified
      ? `The artifact carries a reference${amountSeen ? ", the obligation amount" : ""}${date ? " and a date" : ""}.`
      : "The artifact is missing signals the obligation requires.",
    discrepancies,
  };
}

const STOPWORDS = new Set([
  "about", "after", "before", "certificate", "confirmation", "document", "evidence",
  "proof", "receipt", "report", "required", "signed", "stamped", "uploaded",
]);

function findAmounts(text) {
  const out = [];
  const matches = text.matchAll(/(?:USD|\$)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\.[0-9]{2}))\s?(?:USD|\$)?/gi);
  for (const match of matches) {
    const raw = (match[1] || match[2] || "").replace(/,/g, "");
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) out.push(value);
  }
  return out;
}
