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
                    console.error(`Error executing command: ${command}`);
                    console.error(stderr);
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

async function runAnalysis(videoPath: string) {
    console.log(`Starting analysis for: ${videoPath}`);

    const tempDir = path.join(process.cwd(), "tmp");
    const extension = path.extname(videoPath);
    const videoBasename = path.basename(videoPath, extension);

    // The final audio path should always be a .wav file.
    let audioPath = path.join(tempDir, `${videoBasename}.wav`);

    const csvPath = path.join(tempDir, `${videoBasename}.csv`);
    const openSmileDir = "/Users/noonejoze/Projects/opensmile";

    try {
        // 1. Check if video file exists
        await fs.access(videoPath);
        console.log("Video file found.");

        // 2. Extract audio from video using ffmpeg, if it's not already a wav
        if (extension !== ".wav") {
            console.log("Extracting audio with ffmpeg...");
            const ffmpegCommand = `ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`;
            await execAsync(ffmpegCommand);
            console.log(`Audio extracted to: ${audioPath}`);
        } else {
            console.log("Input is already a .wav file, skipping ffmpeg.");
            // If the input is already a wav, we use its path directly.
            audioPath = videoPath;
        }

        // 3. Run OpenSMILE to extract features
        console.log("Running OpenSMILE analysis...");
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
        console.log(`Analysis CSV generated at: ${csvPath}`);

        // 4. Parse the CSV output
        console.log("Parsing analysis results...");
        const analysis = await parseCsv(csvPath);
        console.log("Analysis complete:", analysis);

        // 5. Clean up temporary files
        console.log("Cleaning up temporary files...");
        await fs.unlink(audioPath);
        await fs.unlink(csvPath);
        console.log("Cleanup complete.");

        return { success: true, analysis };
    } catch (error) {
        console.error("Error during voice analysis:", error);
        return { success: false, error: "Analysis failed." };
    }
}

// Get the video path from command-line arguments
const videoArg = process.argv[2];

if (!videoArg) {
    console.error("Please provide the path to the video file.");
    process.exit(1);
}

const videoPath = path.resolve(videoArg);
runAnalysis(videoPath);
