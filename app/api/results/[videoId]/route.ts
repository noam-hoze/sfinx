import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";

// Promisify the exec function
const execAsync = (
    command: string,
    options?: import("child_process").ExecOptions
) => {
    return new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({
                    stdout: stdout.toString(),
                    stderr: stderr.toString(),
                });
            });
        }
    );
};

async function parseCsv(filePath: string): Promise<Record<string, number>> {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const lines = fileContent.split("\n");

    const attributeLines = lines.filter((line) =>
        line.startsWith("@attribute")
    );
    const header = attributeLines.map((line) => line.split(" ")[1]);

    // The last line should be the data
    const dataLine = lines[lines.length - 2]; // -2 because the last line is often empty
    const values = dataLine.split(",");

    const results: Record<string, string> = {};
    header.forEach((key, index) => {
        results[key] = values[index];
    });

    const summary: Record<string, number> = {
        pitch: 0,
        jitter: 0,
        loudness: 0,
        harshness: 0,
    };

    const featureMapping: Record<string, string> = {
        F0_sma_amean: "pitch",
        pcm_loudness_sma_amean: "loudness",
    };

    for (const key in featureMapping) {
        if (results[key] !== undefined) {
            summary[featureMapping[key]] = parseFloat(results[key] as string);
        }
    }
    return summary;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    const { videoId } = await params;
    const tempDir = path.join(process.cwd(), "tmp");
    const videoBasename = videoId.replace(path.extname(videoId), "");
    const videoPath = path.join(tempDir, videoId);
    const audioPath = path.join(tempDir, `${videoBasename}.wav`);
    const csvPath = path.join(tempDir, `${videoBasename}.csv`);
    const openSmileDir = "/Users/noonejoze/Projects/opensmile";

    try {
        // 1. Check if video file exists
        await fs.access(videoPath);

        // 2. Extract audio from video using ffmpeg
        const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`;
        await execAsync(ffmpegCommand);

        // 3. Run OpenSMILE to extract features
        const smileExtractPath = path.join(
            openSmileDir,
            "build/progsrc/smilextract/SMILExtract"
        );

        // Use absolute paths to avoid any ambiguity
        const configPath = path.join(
            openSmileDir,
            "config/emobase/emobase.conf"
        );

        const openSmileCommand = `"${smileExtractPath}" -C "${configPath}" -I "${audioPath}" -O "${csvPath}"`;

        // No need for cwd if we use absolute paths
        await execAsync(openSmileCommand);

        // 4. Parse the CSV output
        const analysis = await parseCsv(csvPath);

        // 5. Clean up temporary files
        await fs.unlink(audioPath);
        await fs.unlink(csvPath);

        return NextResponse.json({ success: true, analysis });
    } catch (error) {
        console.error("Error during voice analysis:", error);
        const message =
            error instanceof Error
                ? error.message
                : "An unknown error occurred.";
        return NextResponse.json(
            { success: false, error: `Analysis failed: ${message}` },
            { status: 500 }
        );
    }
}
