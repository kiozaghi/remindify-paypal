import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp, mkdir, rename, rm, writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const WIDTH = 1600;
const HEIGHT = 900;
const MAX_SECONDS = 180;
const SITE_URL = (process.env.DEMO_SITE_URL || "https://remindify-paypal.vercel.app").replace(/\/+$/, "");
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";

const scenes = [
  {
    route: "/today",
    expected: "Approvals",
    narration: "Every business has a back office nobody put on the org chart: filings, renewals, contractor work, and invoices that come back around. Remindify puts that work in one register, with an owner, a backup, and a clear next step.",
    featureCard: {
      label: "01 / THE REGISTER",
      title: "Work that comes back, owned.",
      facts: ["Every obligation has a named owner", "A backup catches missed handoffs", "Proof closes the loop"],
    },
  },
  {
    route: "/capture",
    expected: "Give it to Remy.",
    narration: "Start with a notice or a messy handoff. Gemini can extract the amount, due date, provider, and proof requirement into a draft. Here we review the extracted details before accepting anything; a draft is not scheduled work.",
    featureCard: {
      label: "02 / CAPTURE",
      title: "From notice to owned work.",
      facts: ["AI extracts dates and amounts", "A person reviews every draft", "Nothing schedules itself"],
    },
    scrollPoints: [0.25, 0.52, 0.78],
    prepare: async (page) => {
      await page.getByRole("button", { name: /Delaware withholding notice/i }).first().click();
      await page.getByRole("button", { name: "Parse & structure" }).click();
      await page.locator(".drafts-block").waitFor({ state: "visible", timeout: 30_000 }).catch(async () => {
        const pageText = (await page.locator("body").innerText()).slice(-1200);
        throw new Error(`Capture did not produce reviewable drafts. Visible page text: ${pageText}`);
      });
    },
  },
  {
    route: "/obligations",
    expected: "Obligations",
    narration: "The register makes responsibility visible. Switch to Agent Studio and each row adds risk, autonomy, the agent passport, its spend ceiling, and the payment state. The human can see what is delegated and what still needs approval.",
    featureCard: {
      label: "03 / AGENT STUDIO",
      title: "Governance, in every row.",
      facts: ["Risk and autonomy at a glance", "Agent passport and spend cap", "PayPal state beside the work"],
    },
    scrollPoints: [0.28, 0.55, 0.82],
    prepare: async (page) => {
      await page.getByRole("button", { name: /Agent Studio/i }).click();
      await page.getByText(/AG Grid/i).first().waitFor({ state: "visible" });
    },
  },
  {
    route: "/agents",
    expected: "Agents & automations",
    narration: "Agents work inside a boundary, not as free-floating bots. Their scopes, autonomy ceilings, connector status, and recent work are visible alongside the human-owned register. If an executor is not connected, the agent cannot claim it acted.",
    featureCard: {
      label: "04 / AGENTS",
      title: "A passport, not a blank check.",
      facts: ["Scoped tools and permissions", "Autonomy capped by the owner", "Execution is reported, not assumed"],
    },
    scrollPoints: [0.3, 0.6, 0.84],
  },
  {
    route: "/trust",
    expected: "Proof before",
    narration: "The trust layer separates evidence from settlement. A PayPal authorization hold stays in the sandbox; proof is checked against the obligation before a release can be considered. This account shows the seeded demo state only. This recording does not move money.",
    featureCard: {
      label: "05 / TRUST",
      title: "Evidence before settlement.",
      facts: ["PayPal authorization holds funds", "Proof is audited against the work", "Sandbox only · no money moves here"],
    },
    scrollPoints: [0.3, 0.6, 0.84],
  },
  {
    route: "/access",
    expected: "Agent access",
    narration: "The same workspace is available to people and agents through REST and MCP. Machine access is scoped and audited, while spending ceilings remain part of the approval path. Remindify is live software; PayPal shown here is sandbox, with test money only.",
    featureCard: {
      label: "06 / AGENT ACCESS",
      title: "One register. Two interfaces.",
      facts: ["REST endpoints for integrations", "MCP tools for connected agents", "Scoped keys and an audit trail"],
    },
    scrollPoints: [0.25, 0.55, 0.82],
  },
  {
    route: "/today",
    expected: "Approvals",
    narration: "Agents prepare. People approve. Work is only complete when the required proof is there. That is Remindify: the register for everything that comes back.",
    featureCard: {
      label: "07 / THE RULE",
      title: "Agents prepare. You approve.",
      facts: ["Work stays inside its mandate", "People remain accountable", "Money moves on proof"],
    },
    scrollPoints: [0.2, 0.45, 0],
  },
];

function help() {
  console.log([
    "Generate the Remindify hackathon walkthrough from the deployed site.",
    "",
    "Required: GEMINI_API_KEY, ffmpeg, ffprobe, and Google Chrome.",
    "Optional: DEMO_SITE_URL, CHROME_PATH, GEMINI_TTS_MODEL, GEMINI_TTS_VOICE.",
    "",
    "Run: npm run demo:generate",
    "The script creates and deletes a disposable production account, captures read-only",
    "product screens, generates Gemini narration, burns captions, and replaces",
    "public/demo/remindify-demo.mp4 only after the final duration is verified.",
    "Successful narration scenes are cached locally in .demo-cache/narration and reused on rerun.",
  ].join("\n"));
}

function sentenceCaptions(text, start, duration) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const counts = sentences.map((sentence) => sentence.trim().split(/\s+/).length);
  const totalWords = counts.reduce((sum, count) => sum + count, 0);
  let cursor = start;

  return sentences.map((sentence, index) => {
    const length = duration * counts[index] / totalWords;
    const caption = {
      start: cursor,
      end: cursor + length,
      text: sentence.trim(),
    };
    cursor += length;
    return caption;
  });
}

function wrapCaption(text, maxLineLength = 64) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > maxLineLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function run(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, { maxBuffer: 8 * 1024 * 1024, ...options });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`${command} failed: ${detail}`);
  }
}

async function mediaDuration(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]);
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`Could not read media duration: ${file}`);
  return seconds;
}

async function generateNarration(scene, index, directory, apiKey) {
  const cacheDirectory = resolve(".demo-cache/narration");
  await mkdir(cacheDirectory, { recursive: true, mode: 0o700 });
  const cacheKey = createHash("sha256")
    .update(`${TTS_MODEL}\n${TTS_VOICE}\n${scene.narration}`)
    .digest("hex");
  const wavPath = join(cacheDirectory, `${cacheKey}.wav`);
  try {
    const duration = await mediaDuration(wavPath);
    console.log(`  Scene ${index + 1}: reusing cached narration (${duration.toFixed(1)}s)`);
    return { wavPath, duration };
  } catch {
    await rm(wavPath, { force: true });
  }

  if (!apiKey) {
    throw new Error(`Narration for scene ${index + 1} is not cached; set GEMINI_API_KEY before generating it.`);
  }

  const prompt = [
    "Read the narration exactly as written, without adding or omitting words.",
    "Use a warm, clear, confident documentary voice at a natural conversational pace.",
    `Narration: ${scene.narration}`,
  ].join("\n");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TTS_MODEL)}:generateContent`;
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
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
    throw new Error(`Gemini TTS returned no supported PCM audio for scene ${index + 1}.`);
  }
  const sampleRate = Number(audio.mimeType.match(/rate=(\d+)/)?.[1] || 24_000);
  const channels = Number(audio.mimeType.match(/channels=(\d+)/)?.[1] || 1);
  const pcmPath = join(directory, `narration-${index + 1}.pcm`);
  const temporaryWavPath = join(directory, `narration-${index + 1}.wav`);
  await writeFile(pcmPath, Buffer.from(audio.data, "base64"), { mode: 0o600 });
  await run("ffmpeg", [
    "-y", "-v", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", String(channels),
    "-i", pcmPath, "-af", "aresample=48000,apad=pad_dur=0.4", "-ar", "48000", "-ac", "2",
    "-c:a", "pcm_s16le", temporaryWavPath,
  ]);
  await rm(pcmPath, { force: true });
  await rename(temporaryWavPath, wavPath);
  return { wavPath, duration: await mediaDuration(wavPath) };
}

async function createDisposableAccount(browser, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${SITE_URL}/signup`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const result = await page.evaluate(async ({ accountEmail, accountPassword }) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hackathon Demo", email: accountEmail, password: accountPassword }),
    });
    const payload = await response.json();
    return { status: response.status, payload };
  }, { accountEmail: email, accountPassword: password });
  if (result.status < 200 || result.status >= 300 || !result.payload.user) {
    await context.close();
    throw new Error(`Could not create the disposable demo account (${result.status}): ${result.payload.message || result.payload.error || "signup failed"}`);
  }
  const session = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session");
    return response.json();
  });
  if (!session.user) {
    let cleanupFailure;
    try {
      await deleteDisposableAccount(context, password);
    } catch (error) {
      cleanupFailure = error;
    }
    await context.close();
    if (cleanupFailure) {
      throw new Error(`Signup created ${email}, but its session failed and account cleanup also failed: ${cleanupFailure.message}`);
    }
    throw new Error("The new demo account did not establish a signed-in session.");
  }
  return { context, page };
}

async function captureScene(browser, scene, index, sceneAudio, storageStatePath, directory) {
  const sceneDirectory = join(directory, `scene-${index + 1}`);
  await mkdir(sceneDirectory);
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    storageState: storageStatePath,
    recordVideo: { dir: sceneDirectory, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();
  const recordingStart = Date.now();
  await page.goto(`${SITE_URL}${scene.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByText(scene.expected, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
  const skipWelcome = page.getByRole("button", { name: "Skip", exact: true });
  if (await skipWelcome.isVisible().catch(() => false)) {
    await skipWelcome.click();
    await skipWelcome.waitFor({ state: "hidden", timeout: 10_000 });
    await context.storageState({ path: storageStatePath });
  }
  if (scene.prepare) await scene.prepare(page);
  await page.waitForTimeout(1000);
  const trimStart = Math.max(0, (Date.now() - recordingStart) / 1000);
  const scrollPoints = scene.scrollPoints || [0.24, 0.56, 0.82];
  let elapsed = 0;
  for (const [pointIndex, ratio] of scrollPoints.entries()) {
    const targetTime = sceneAudio.duration * (0.25 + pointIndex * 0.26);
    await page.waitForTimeout(Math.max(0, Math.round((targetTime - elapsed) * 1000)));
    await page.evaluate((scrollRatio) => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: maxScroll * scrollRatio, behavior: "smooth" });
    }, ratio);
    await page.mouse.move(900 + pointIndex * 120, 420 + pointIndex * 45, { steps: 12 });
    elapsed = targetTime + 0.55;
  }
  await page.waitForTimeout(Math.max(0, Math.ceil((sceneAudio.duration - elapsed + 0.6) * 1000)));
  const video = page.video();
  await context.close();
  if (!video) throw new Error(`Playwright did not record scene ${index + 1}.`);
  const source = await video.path();
  const output = join(directory, `scene-${index + 1}.mp4`);
  const cardPath = await renderFeatureCard(browser, scene.featureCard, index, directory);
  const duration = sceneAudio.duration;
  const cardIn = Math.max(1.5, duration * 0.27);
  const cardOut = Math.max(cardIn + 2.5, duration * 0.78);
  const slideDuration = 0.45;
  const cardX = 1295;
  const baseFilter = [
    "[0:v]fps=30",
    "scale=1920:1080:force_original_aspect_ratio=decrease",
    "pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
    "setsar=1",
    "zoompan=z='min(zoom+0.00006,1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30",
    "tpad=stop_mode=clone:stop_duration=1[base]",
  ].join(",");
  const filter = `${baseFilter};[base][1:v]overlay=x='if(lt(t,${cardIn.toFixed(2)}),1920,if(lt(t,${(cardIn + slideDuration).toFixed(2)}),1920-(1920-${cardX})*(t-${cardIn.toFixed(2)})/${slideDuration},if(lt(t,${(cardOut - slideDuration).toFixed(2)}),${cardX},${cardX}+(1920-${cardX})*(t-${(cardOut - slideDuration).toFixed(2)})/${slideDuration})))':y=116:enable='between(t,${cardIn.toFixed(2)},${cardOut.toFixed(2)})':format=auto,format=yuv420p[v]`;
  const renderArgs = [
    "-y", "-v", "error", "-ss", trimStart.toFixed(3), "-i", source, "-loop", "1", "-i", cardPath,
    "-t", sceneAudio.duration.toFixed(3), "-filter_complex", filter, "-map", "[v]", "-an",
    "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-r", "30", output,
  ];
  try {
    await run("ffmpeg", renderArgs);
  } catch (error) {
    throw new Error(`${error.message}\nScene render input: ${source}\nFilter graph: ${filter}`);
  }
  return output;
}

async function deleteDisposableAccount(context, password) {
  const response = await context.request.post(`${SITE_URL}/api/account/delete`, {
    data: { confirm: "delete", password },
  });
  const payload = await response.json();
  if (!response.ok() || !payload.ok || !payload.purged_workspace) {
    throw new Error(`Could not delete the disposable demo account (${response.status()}): ${payload.message || payload.error || "delete failed"}`);
  }
}

async function renderCaptionImages(browser, captions, directory) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const images = [];
  for (const [index, caption] of captions.entries()) {
    const file = join(directory, `caption-${index + 1}.png`);
    const lines = wrapCaption(caption.text).split("\n").map(escapeHtml).join("<br>");
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; margin: 0; background: transparent; overflow: hidden; }
      .caption { position: absolute; left: 50%; bottom: 60px; transform: translateX(-50%);
        max-width: 84%; padding: 10px 20px; border-radius: 8px; background: rgba(0,0,0,.82);
        color: #fff; font: 25px/1.25 Arial, sans-serif; text-align: center; }
    </style></head><body><div class="caption">${lines}</div></body></html>`);
    await page.screenshot({ path: file, omitBackground: true });
    images.push(file);
  }
  await context.close();
  return images;
}

async function renderFeatureCard(browser, featureCard, index, directory) {
  const context = await browser.newContext({ viewport: { width: 700, height: 420 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const label = escapeHtml(featureCard.label);
  const title = escapeHtml(featureCard.title);
  const facts = featureCard.facts.map((fact, factIndex) => `
    <div class="fact" style="animation-delay:${0.12 + factIndex * 0.12}s">
      <span class="fact-index">0${factIndex + 1}</span><span>${escapeHtml(fact)}</span>
    </div>`).join("");
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    html, body { width: 700px; height: 420px; margin: 0; background: transparent; }
    .card { position: relative; width: 620px; padding: 30px 32px 28px; border-radius: 22px;
      overflow: hidden; color: #ede9df; font-family: Arial, sans-serif;
      background: radial-gradient(ellipse at 92% 6%, rgba(217,242,106,.17), transparent 40%),
      linear-gradient(145deg, #212219 0%, #11120e 100%);
      border: 1px solid rgba(217,242,106,.38);
      box-shadow: 0 26px 70px rgba(0,0,0,.3); }
    .eyebrow { color: #d9f26a; font: 11px/1.3 monospace; letter-spacing: .16em; margin-bottom: 12px; }
    h2 { font-size: 30px; line-height: 1.1; letter-spacing: -.035em; margin: 0 0 21px; font-weight: 600; }
    .facts { display: grid; gap: 9px; }
    .fact { display: flex; align-items: center; gap: 13px; font-size: 17px; line-height: 1.25;
      color: rgba(237,233,223,.88); opacity: 0; transform: translateY(8px);
      animation: rise .36s cubic-bezier(.2,.7,.2,1) forwards; }
    .fact-index { color: #14140f; background: #d9f26a; border-radius: 7px; width: 27px; height: 25px;
      display: grid; place-items: center; font: 10px monospace; flex: none; }
    .rule { width: 40px; height: 3px; border-radius: 9px; background: #d9f26a; margin-bottom: 17px; }
    @keyframes rise { to { opacity: 1; transform: translateY(0); } }
  </style></head><body><section class="card">
    <div class="eyebrow">${label}</div><div class="rule"></div><h2>${title}</h2><div class="facts">${facts}</div>
  </section></body></html>`);
  const card = page.locator(".card");
  await page.waitForTimeout(650);
  await card.screenshot({ path: join(directory, `feature-card-${index + 1}.png`), omitBackground: true });
  const cardPath = join(directory, `feature-card-${index + 1}.png`);
  await context.close();
  return cardPath;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    help();
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  for (const command of ["ffmpeg", "ffprobe"]) await run(command, ["-version"]);
  const chromePath = process.env.CHROME_PATH || [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].find((candidate) => existsSync(candidate));
  if (!chromePath || !existsSync(chromePath)) {
    throw new Error("Google Chrome was not found. Set CHROME_PATH to a local Chrome or Chromium executable.");
  }

  const outputPath = resolve("public/demo/remindify-demo.mp4");
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "remindify-demo-"));
  const audioSegments = [];
  const captions = [];
  let captionOffset = 0;
  let accountContext;
  let browser;
  let accountPassword;
  let accountEmail;
  let primaryError;
  let cleanupError;

  try {
    console.log("Generating Gemini narration...");
    for (const [index, scene] of scenes.entries()) {
      const audio = await generateNarration(scene, index, temporaryDirectory, apiKey);
      if (captionOffset + audio.duration > MAX_SECONDS) {
        throw new Error("The generated narration exceeds three minutes; shorten the script before rendering.");
      }
      scene.audioDuration = audio.duration;
      audioSegments.push(audio.wavPath);
      captions.push(...sentenceCaptions(scene.narration, captionOffset, audio.duration - 0.4));
      captionOffset += audio.duration;
      console.log(`  Scene ${index + 1}/${scenes.length}: ${audio.duration.toFixed(1)}s`);
    }
    if (captionOffset > MAX_SECONDS) throw new Error("The video would exceed the 3:00 limit.");

    browser = await chromium.launch({ executablePath: chromePath, headless: true });
    accountEmail = `hackathon-demo-${randomBytes(8).toString("hex")}@example.com`;
    accountPassword = randomBytes(24).toString("base64url");
    console.log("Creating a disposable account on the deployed site...");
    const account = await createDisposableAccount(browser, accountEmail, accountPassword);
    accountContext = account.context;
    const storageStatePath = join(temporaryDirectory, "session.json");
    await accountContext.storageState({ path: storageStatePath });

    const videoSegments = [];
    for (const [index, scene] of scenes.entries()) {
      console.log(`Recording live-site scene ${index + 1}/${scenes.length}: ${scene.route}`);
      videoSegments.push(await captureScene(browser, scene, index, { duration: scene.audioDuration }, storageStatePath, temporaryDirectory));
    }

    const videoListPath = join(temporaryDirectory, "video-list.txt");
    const audioListPath = join(temporaryDirectory, "audio-list.txt");
    await writeFile(videoListPath, videoSegments.map((file) => `file '${file}'`).join("\n"));
    await writeFile(audioListPath, audioSegments.map((file) => `file '${file}'`).join("\n"));
    const joinedVideo = join(temporaryDirectory, "joined-video.mp4");
    const joinedAudio = join(temporaryDirectory, "joined-audio.wav");
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", videoListPath, "-c", "copy", joinedVideo]);
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", audioListPath, "-c", "copy", joinedAudio]);

    const captionImages = await renderCaptionImages(browser, captions, temporaryDirectory);
    const renderedPath = join(temporaryDirectory, "remindify-demo.mp4");
    const totalDuration = await mediaDuration(joinedAudio);
    if (totalDuration > MAX_SECONDS) throw new Error("The rendered narration exceeds the 3:00 limit.");
    const filterParts = [];
    let previousVideo = "[0:v]";
    captionImages.forEach((_, index) => {
      const outputLabel = index === captionImages.length - 1 ? "[vout]" : `[v${index}]`;
      const caption = captions[index];
      filterParts.push(
        `${previousVideo}[${index + 2}:v]overlay=0:0:format=auto:enable='between(t,${caption.start.toFixed(3)},${caption.end.toFixed(3)})'${outputLabel}`,
      );
      previousVideo = outputLabel;
    });
    await run("ffmpeg", [
      "-y", "-v", "error", "-i", joinedVideo, "-i", joinedAudio,
      ...captionImages.flatMap((image) => ["-i", image]),
      "-filter_complex", `${filterParts.join(";")};[vout]format=yuv420p[vfinal]`,
      "-map", "[vfinal]", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
      renderedPath,
    ]);
    const finalDuration = await mediaDuration(renderedPath);
    if (finalDuration > MAX_SECONDS) throw new Error(`Final video is ${finalDuration.toFixed(1)} seconds, above the 3:00 limit.`);
    await rename(renderedPath, outputPath);
    console.log(`Finished ${outputPath} (${finalDuration.toFixed(1)} seconds).`);
  } catch (error) {
    primaryError = error;
    if (String(error.message).includes("Gemini TTS request failed")) {
      console.error("Completed narration is cached in .demo-cache/narration. Fix or replace the Gemini API key, then rerun the same command to continue.");
    }
  } finally {
    if (accountContext && accountPassword) {
      try {
        await deleteDisposableAccount(accountContext, accountPassword);
        console.log("Deleted the disposable production account and its seeded workspace.");
      } catch (error) {
        cleanupError = error;
      }
      await accountContext.close();
    }
    if (browser) await browser.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  if (primaryError && cleanupError) {
    throw new AggregateError([primaryError, cleanupError], `Generation failed and the disposable account ${accountEmail} may still exist.`);
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw new Error(`The video was generated, but disposable account ${accountEmail} could not be deleted: ${cleanupError.message}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
