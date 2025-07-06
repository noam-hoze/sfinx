import { exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import util from "util";

const execAsync = util.promisify(exec);

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
        smile: header.indexOf("AU12_r"),
        browFurrow: header.indexOf("AU04_r"),
        mouthOpen: header.indexOf("AU25_r"),
    };

    // Check for headers with a leading space, which is common
    if (auColumns.smile === -1) auColumns.smile = header.indexOf(" AU12_r");
    if (auColumns.browFurrow === -1)
        auColumns.browFurrow = header.indexOf(" AU04_r");
    if (auColumns.mouthOpen === -1)
        auColumns.mouthOpen = header.indexOf(" AU25_r");

    let validFrames = 0;
    const totals = { smile: 0, browFurrow: 0, mouthOpen: 0 };

    const successIndex = header.indexOf("success");
    const confidenceIndex = header.indexOf("confidence");

    for (const line of dataLines) {
        const values = line.split(",").map((v) => v.trim());
        const success = parseInt(values[successIndex], 10);
        const confidence = parseFloat(values[confidenceIndex]);

        if (success === 1 && confidence > 0.8) {
            validFrames++;
            if (auColumns.smile !== -1)
                totals.smile += parseFloat(values[auColumns.smile]);
            if (auColumns.browFurrow !== -1)
                totals.browFurrow += parseFloat(values[auColumns.browFurrow]);
            if (auColumns.mouthOpen !== -1)
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

async function runVideoAnalysis(
    videoPath: string
): Promise<Record<string, number>> {
    if (!videoPath) {
        throw new Error("Video path is required.");
    }

    console.log(`Starting video analysis for: ${videoPath}`);

    const tempDir = await fs.mkdtemp(path.join(process.cwd(), "tmp-"));
    const videoBasename = path
        .basename(videoPath)
        .replace(path.extname(videoPath), "");

    try {
        // Define paths
        const openFaceDir = "/Users/noonejoze/Projects/OpenFace";
        const openFaceOutputDir = path.join(tempDir, "openface_output");
        await fs.mkdir(openFaceOutputDir, { recursive: true });

        const convertedVideoPath = path.join(tempDir, `${videoBasename}.mp4`);

        // 1. Convert video to mp4
        console.log(`Converting video to ${convertedVideoPath}...`);
        const ffmpegCommand = `ffmpeg -y -i "${videoPath}" "${convertedVideoPath}"`;
        await execAsync(ffmpegCommand);
        console.log("Video converted successfully.");

        // 2. Run OpenFace FeatureExtraction
        const openFaceExecutable = path.join(
            openFaceDir,
            "build/bin/FeatureExtraction"
        );
        const openFaceCommand = `"${openFaceExecutable}" -f "${convertedVideoPath}" -out_dir "${openFaceOutputDir}"`;

        console.log("Running OpenFace analysis...");
        console.log(`Command: ${openFaceCommand}`);
        await execAsync(openFaceCommand);
        console.log("OpenFace analysis complete.");

        // 3. Parse the output
        const outputCsvPath = path.join(
            openFaceOutputDir,
            `${videoBasename}.csv`
        );
        await fs.access(outputCsvPath); // Check if the file was created
        console.log(`Parsing output file: ${outputCsvPath}`);

        const analysisResults = await parseOpenFaceCsv(outputCsvPath);
        return analysisResults;
    } catch (error) {
        console.error(
            "An error occurred in runVideoAnalysis:",
            (error as Error).message
        );
        throw error;
    } finally {
        // 4. Cleanup the temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

const videoArg = process.argv[2];

if (!videoArg) {
    console.error("Please provide the path to the video file.");
    process.exit(1);
}

const videoPath = path.resolve(videoArg);
runVideoAnalysis(videoPath);
