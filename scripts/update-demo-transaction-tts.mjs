import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const VIDEO_PATH = resolve("public/demo/remindify-demo.mp4");
const MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const VOICE = process.env.GEMINI_TTS_VOICE || "Kore";
const INSERT_START = 84;
const INSERT_DURATION = 31.4;
const VOICE_OFFSET = 6;
const MAX_VOICE_DURATION = INSERT_DURATION - VOICE_OFFSET - 0.4;
const NARRATION = "Here is the payment path, from the obligation into PayPal sandbox checkout. The buyer confirms an eighteen-dollar payment; no real funds move. Remindify records the result as settled, files the captured payment as proof, and keeps its PayPal reference in the ledger. This makes the transaction traceable from the checkout back to the work.";

async function run(command, args) {
  try {
    return await execFileAsync(command, args, { maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`${command} failed: ${detail}`);
  }
}

async function mediaDuration(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not read audio duration: ${path}`);
  return duration;
}

async function synthesize(apiKey, directory) {
  const prompt = [
    "Read the narration exactly as written, without adding or omitting words.",
    "Use a warm, clear, confident documentary voice at a natural conversational pace.",
    `Narration: ${NARRATION}`,
  ].join("\n");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
    });
    if (response.ok || (response.status < 500 && response.status !== 429) || attempt === 2) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000 * (attempt + 1)));
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini TTS request failed (${response.status}): ${detail.slice(0, 1000)}`);
  }

  const result = await response.json();
  const audio = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!audio?.data || !audio.mimeType?.startsWith("audio/L16")) {
    throw new Error("Gemini TTS returned no supported PCM audio.");
  }

  const sampleRate = Number(audio.mimeType.match(/rate=(\d+)/)?.[1] || 24_000);
  const channels = Number(audio.mimeType.match(/channels=(\d+)/)?.[1] || 1);
  const pcmPath = join(directory, "transaction.pcm");
  const wavPath = join(directory, "transaction.wav");
  await writeFile(pcmPath, Buffer.from(audio.data, "base64"), { mode: 0o600 });
  await run("ffmpeg", [
    "-y", "-v", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", String(channels),
    "-i", pcmPath, "-af", "aresample=48000,apad=pad_dur=0.4",
    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", wavPath,
  ]);
  await rm(pcmPath, { force: true });

  const duration = await mediaDuration(wavPath);
  if (duration > MAX_VOICE_DURATION) {
    throw new Error(`Gemini narration is ${duration.toFixed(1)}s; it must fit within ${MAX_VOICE_DURATION.toFixed(1)}s to stay in sync with the burned-in captions.`);
  }
  return wavPath;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing from this process environment.");
  await readFile(VIDEO_PATH);

  const directory = await mkdtemp(join(dirname(VIDEO_PATH), ".demo-transaction-tts-"));
  const outputPath = join(directory, "remindify-demo.mp4");
  try {
    const narrationPath = await synthesize(apiKey, directory);
    const filter = [
      "[0:a]asplit=2[before0][after0]",
      `[before0]atrim=start=0:duration=${INSERT_START},asetpts=PTS-STARTPTS[before]`,
      `[after0]atrim=start=${INSERT_START + INSERT_DURATION},asetpts=PTS-STARTPTS[after]`,
      `[1:a]adelay=${VOICE_OFFSET * 1000}|${VOICE_OFFSET * 1000},apad=pad_dur=0.4,atrim=duration=${INSERT_DURATION},asetpts=PTS-STARTPTS[middle]`,
      "[before][middle][after]concat=n=3:v=0:a=1[a]",
    ].join(";");
    await run("ffmpeg", [
      "-y", "-v", "error", "-i", VIDEO_PATH, "-i", narrationPath,
      "-filter_complex", filter, "-map", "0:v:0", "-map", "[a]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      "-movflags", "+faststart", outputPath,
    ]);

    const [originalDuration, outputDuration] = await Promise.all([
      mediaDuration(VIDEO_PATH),
      mediaDuration(outputPath),
    ]);
    if (Math.abs(originalDuration - outputDuration) > 0.1) {
      throw new Error(`Audio replacement changed the video duration (${originalDuration.toFixed(2)}s to ${outputDuration.toFixed(2)}s).`);
    }

    await rename(outputPath, VIDEO_PATH);
    console.log(`Updated transaction narration with Gemini ${VOICE} TTS (${(await mediaDuration(narrationPath)).toFixed(1)}s).`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
