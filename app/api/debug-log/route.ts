import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const logLine = JSON.stringify({ ...data, serverTime: Date.now() }) + '\n';
    const logPath = join(process.cwd(), 'mascot-debug.log');
    appendFileSync(logPath, logLine);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
