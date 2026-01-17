import { NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id");
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    log.error(LOG_CATEGORY, "[Transcribe API] Error", {
      requestId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
