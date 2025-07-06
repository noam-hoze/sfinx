import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const MOCK_ANALYSIS = true;

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

async function parseOpenFaceCsv(
    filePath: string
): Promise<Record<string, number>> {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const lines = fileContent.trim().split("\n");

    if (lines.length < 2) {
        return {}; // No data
    }

    const header = lines[0].split(",").map((s) => s.trim());
    const dataLines = lines.slice(1);

    const summary = {
        smile: 0, // AU12_r: Lip Corner Puller
        browFurrow: 0, // AU04_r: Brow Lowerer
        mouthOpen: 0, // AU25_r: Lips part
    };

    const auColumns = {
        smile: header.indexOf(" AU12_r"),
        browFurrow: header.indexOf(" AU04_r"),
        mouthOpen: header.indexOf(" AU25_r"),
    };

    let validFrames = 0;
    const totals = { smile: 0, browFurrow: 0, mouthOpen: 0 };

    for (const line of dataLines) {
        const values = line.split(",");
        const success = parseInt(values[header.indexOf(" success")].trim(), 10);
        const confidence = parseFloat(
            values[header.indexOf(" confidence")].trim()
        );

        if (success === 1 && confidence > 0.8) {
            validFrames++;
            totals.smile += parseFloat(values[auColumns.smile]);
            totals.browFurrow += parseFloat(values[auColumns.browFurrow]);
            totals.mouthOpen += parseFloat(values[auColumns.mouthOpen]);
        }
    }

    if (validFrames > 0) {
        summary.smile = totals.smile / validFrames;
        summary.browFurrow = totals.browFurrow / validFrames;
        summary.mouthOpen = totals.mouthOpen / validFrames;
    }

    return summary;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    if (MOCK_ANALYSIS) {
        // Return mock data immediately if the flag is true
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay
        return NextResponse.json({
            success: true,
            analysis: {
                voice: {
                    pitch: 165.3,
                    jitter: 0.015,
                    loudness: 0.6,
                    harshness: 12.1,
                },
                video: {
                    smile: 0.65,
                    browFurrow: 0.21,
                    mouthOpen: 0.4,
                },
            },
        });
    }

    const { videoId } = await params;
    const tempDir = path.join(process.cwd(), "tmp");
    const videoBasename = videoId.replace(path.extname(videoId), "");
    const videoPath = path.join(tempDir, videoId);

    // Paths for openSMILE
    const audioPath = path.join(tempDir, `${videoBasename}.wav`);
    const smileCsvPath = path.join(tempDir, `${videoBasename}_smile.csv`);
    const openSmileDir = "/Users/noonejoze/Projects/opensmile";

    // Paths for OpenFace
    const openFaceOutputDir = path.join(tempDir, "openface_output");
    await fs.mkdir(openFaceOutputDir, { recursive: true });
    const openFaceCsvPath = path.join(
        openFaceOutputDir,
        `${videoBasename}.csv`
    );

    try {
        // 1. Check if video file exists
        await fs.access(videoPath);

        // Voice Analysis (openSMILE)
        const voiceAnalysisPromise = (async () => {
            const ffmpegCommand = `ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`;
            await execAsync(ffmpegCommand);

            const smileExtractPath = path.join(
                openSmileDir,
                "build/progsrc/smilextract/SMILExtract"
            );
            const configPath = path.join(
                openSmileDir,
                "config/emobase/emobase.conf"
            );
            const openSmileCommand = `"${smileExtractPath}" -C "${configPath}" -I "${audioPath}" -O "${smileCsvPath}"`;
            await execAsync(openSmileCommand);

            const analysis = await parseCsv(smileCsvPath);
            await fs.unlink(audioPath);
            await fs.unlink(smileCsvPath);
            return analysis;
        })();

        // Video Analysis (OpenFace)
        const videoAnalysisPromise = (async () => {
            const openFaceCommand = `docker run --rm -v "${tempDir}:/data" openface /root/OpenFace/build/bin/FaceLandmarkVid -f "/data/${videoId}" -out_dir "/data/openface_output"`;
            await execAsync(openFaceCommand);

            const analysis = await parseOpenFaceCsv(openFaceCsvPath);

            await fs.unlink(openFaceCsvPath);

            return analysis;
        })();

        const [voiceAnalysis, videoAnalysis] = await Promise.all([
            voiceAnalysisPromise,
            videoAnalysisPromise,
        ]);

        await fs.rm(openFaceOutputDir, { recursive: true, force: true });

        return NextResponse.json({
            success: true,
            analysis: {
                voice: voiceAnalysis,
                video: videoAnalysis,
            },
        });
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
