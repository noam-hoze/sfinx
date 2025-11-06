import express, { Request, Response } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { SpeechClient } from "@google-cloud/speech";
import textToSpeech from "@google-cloud/text-to-speech";
import { SessionsClient } from "@google-cloud/dialogflow-cx";
import dotenv from "dotenv";
import { log } from "app/shared/services";

// Load env (supports Next-style .env.local during standalone server run)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

type OutboundMessage =
    | { type: "status"; message: string }
    | { type: "user_text"; text: string }
    | { type: "ai_text"; text: string }
    | { type: "ai_audio"; wavBase64: string };

function encodeWavFromPcm16(
    pcm16: Int16Array,
    sampleRate: number
): ArrayBuffer {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const wavHeaderSize = 44;
    const dataSize = pcm16.length * bytesPerSample;
    const buffer = new ArrayBuffer(wavHeaderSize + dataSize);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, dataSize, true);

    const out = new Int16Array(buffer, wavHeaderSize, pcm16.length);
    out.set(pcm16);
    return buffer;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/voice" });

// Static PoC page (served from Next public directory for simplicity)
const publicDir = path.resolve(process.cwd(), "public");
app.use("/poc", express.static(path.join(publicDir, "poc")));

// Health
app.get("/healthz", (_req: Request, res: Response) =>
    res.status(200).send("ok")
);

wss.on("connection", async (ws: WebSocket) => {
    const send = (m: OutboundMessage) => ws.send(JSON.stringify(m));
    send({ type: "status", message: "Connected to Google PoC WS" });

    // Initialize Google clients once per connection
    const speechClient = new SpeechClient();
    const ttsClient = new textToSpeech.TextToSpeechClient();
    // Default service account path if not provided
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const defaultKey = path.resolve(
            process.cwd(),
            "server/keys/service-account.json"
        );
        if (fs.existsSync(defaultKey)) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = defaultKey;
        }
    }

    const agentLocation = process.env.GOOGLE_AGENT_LOCATION;
    if (!agentLocation) {
        send({
            type: "status",
            message: "Missing GOOGLE_AGENT_LOCATION. Check your environment configuration.",
        });
        try {
            ws.close(1011, "missing env");
        } catch {}
        return;
    }
    const languageCode = process.env.GOOGLE_LANGUAGE;
    if (!languageCode) {
        send({
            type: "status",
            message: "Missing GOOGLE_LANGUAGE. Check your environment configuration.",
        });
        try {
            ws.close(1011, "missing env");
        } catch {}
        return;
    }
    const sessionsClient = new SessionsClient({
        apiEndpoint: `${agentLocation}-dialogflow.googleapis.com`,
    });

    const projectId = process.env.GOOGLE_PROJECT_ID as string;
    const agentId = process.env.DIALOGFLOW_AGENT_ID as string;
    const location = agentLocation;

    if (!projectId || !agentId) {
        send({
            type: "status",
            message:
                "Missing GOOGLE_PROJECT_ID or DIALOGFLOW_AGENT_ID. Check your .env.local",
        });
        try {
            ws.close(1011, "missing env");
        } catch {}
        return;
    }

    const sessionPath = sessionsClient.projectLocationAgentSessionPath(
        projectId,
        location,
        agentId,
        crypto.randomUUID()
    );

    let recognizeStream: any;
    let isStreamActive = false;

    const startStreamingRecognize = () => {
        // Create the stream with the configuration. This sends the first message.
        recognizeStream = speechClient
            .streamingRecognize({
                config: {
                    encoding: "WEBM_OPUS" as any,
                    sampleRateHertz: 48000,
                    languageCode,
                    enableAutomaticPunctuation: true,
                },
                interimResults: true,
            })
            .on("error", (err: any) => {
                const errMessage = err?.message;
                if (!errMessage) {
                    throw new Error("Speech recognition error without message");
                }
                send({
                    type: "status",
                    message: `stt-error: ${errMessage}`,
                });
                isStreamActive = false;
            })
            .on("data", async (data: any) => {
                const result = data?.results?.[0];
                if (!result) return;
                const alt = result.alternatives?.[0];
                if (!alt?.transcript) return;

                if (result.isFinal) {
                    const userText = alt.transcript.trim();
                    send({ type: "user_text", text: userText });

                    // End the current stream and start a new one for the next utterance
                    isStreamActive = false;
                    try {
                        (recognizeStream as any).end();
                    } catch {}

                    try {
                        const [dfcxResp] = await sessionsClient.detectIntent({
                            session: sessionPath,
                            queryInput: {
                                languageCode,
                                text: { text: userText },
                            },
                        });
                        const fulfillmentMessages =
                            dfcxResp.queryResult?.responseMessages ?? [];
                        const fulfillmentText = fulfillmentMessages
                            .map((m: any) => m.text?.text?.[0])
                            .filter(Boolean)
                            .join(" ");
                        if (!fulfillmentText) {
                            throw new Error("Dialogflow response missing fulfillment text");
                        }
                        const aiText = fulfillmentText;
                        send({ type: "ai_text", text: aiText });

                        const sampleRate = 16000;
                        const [ttsResp] = await ttsClient.synthesizeSpeech({
                            input: { text: aiText },
                            voice: { languageCode, ssmlGender: "NEUTRAL" },
                            audioConfig: {
                                audioEncoding: "LINEAR16",
                                sampleRateHertz: sampleRate,
                            },
                        });

                        // FIX: Correctly align the audio buffer for Int16Array
                        const audioBuffer = ttsResp.audioContent as Buffer;
                        const pcm = new Int16Array(
                            audioBuffer.buffer.slice(
                                audioBuffer.byteOffset,
                                audioBuffer.byteOffset + audioBuffer.byteLength
                            )
                        );

                        const wav = encodeWavFromPcm16(pcm, sampleRate);
                        const bytes = new Uint8Array(wav);
                        let binary = "";
                        for (let i = 0; i < bytes.byteLength; i++)
                            binary += String.fromCharCode(bytes[i]);
                        const base64 = Buffer.from(binary, "binary").toString(
                            "base64"
                        );
                        send({ type: "ai_audio", wavBase64: base64 });
                    } catch (err: any) {
                        const errMessage = err?.message;
                        if (!errMessage) {
                            throw new Error("Dialogflow or TTS error without message");
                        }
                        send({
                            type: "status",
                            message: `dfcx/tts-error: ${errMessage}`,
                        });
                    }
                }
            });

        isStreamActive = true;
    };

    // Start the first stream
    startStreamingRecognize();

    ws.on("message", (raw: Buffer) => {
        try {
            if (!isStreamActive) return; // Prevent writing to a closed stream
            const data = raw.toString();
            const parsed = data ? JSON.parse(data) : null;
            if (
                parsed &&
                parsed.type === "audio" &&
                typeof parsed.base64 === "string"
            ) {
                const audioData = Buffer.from(parsed.base64, "base64");

                // Correctly write the raw audio data Buffer to the stream
                recognizeStream.write(audioData);
            } else if (parsed && parsed.type === "ping") {
                send({ type: "status", message: "pong" });
            }
        } catch (err: any) {
            const errMessage = err?.message;
            if (!errMessage) {
                throw new Error("WebSocket message error without message");
            }
            send({
                type: "status",
                message: `error: ${errMessage}`,
            });
        }
    });

    ws.on("close", () => {
        try {
            if (recognizeStream) {
                (recognizeStream as any).end();
            }
        } catch {}
    });
});

const googleVoicePort = process.env.GOOGLE_VOICE_PORT;
if (!googleVoicePort) {
    throw new Error("GOOGLE_VOICE_PORT is required");
}
const PORT = Number(googleVoicePort);
server.listen(PORT, () => {
    log.info(`Google Voice PoC server listening on http://localhost:${PORT}`);
    log.info(`Open PoC UI at http://localhost:${PORT}/poc/google-voice.html`);
});
