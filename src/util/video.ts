import { spawn } from "node:child_process";
import ffmpegPath from "./ffmpg.js";

const convertVideoToGif: (url: string) => Promise<Buffer> = async (url) => {
  try {
    // Download the video into memory
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        "-i",
        "pipe:0", // Input from stdin
        "-f",
        "gif", // Output format
        "-vf",
        "scale=320:-1", // Scale to 320px width, maintain aspect ratio
        "-r",
        "10", // 10 fps
        "-y", // Overwrite output
        "pipe:1", // Output to stdout
      ]);

      const chunks: Buffer[] = [];

      // Write input data
      ffmpeg.stdin.write(videoBuffer);
      ffmpeg.stdin.end();

      // Collect output
      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      ffmpeg.stdout.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      ffmpeg.stderr.on("data", (data) => {
        console.debug("FFmpeg stderr:", data.toString());
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error("Error converting video to GIF:", error);
    throw error;
  }
};

export { convertVideoToGif };
