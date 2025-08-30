import { execSync } from "node:child_process";

// Check if system FFmpeg is available, otherwise fall back to a common path
let ffmpegPath: string;
try {
  // Try to find FFmpeg in system PATH
  const command =
    process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
  ffmpegPath = execSync(command, { encoding: "utf8" }).trim();
  // On Windows, 'where' can return multiple paths, so take the first one
  if (process.platform === "win32" && ffmpegPath.includes("\n")) {
    ffmpegPath = ffmpegPath.split("\n")[0] as string;
  }
} catch {
  // Fallback paths where FFmpeg might be installed
  const possiblePaths =
    process.platform === "win32"
      ? [
          "C:\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
          "%USERPROFILE%\\ffmpeg\\bin\\ffmpeg.exe",
          "ffmpeg.exe",
        ]
      : [
          "/usr/bin/ffmpeg",
          "/usr/local/bin/ffmpeg",
          "/opt/homebrew/bin/ffmpeg",
        ];

  ffmpegPath =
    possiblePaths.find((path) => {
      try {
        const testPath =
          process.platform === "win32" && path.includes("%USERPROFILE%")
            ? path.replace("%USERPROFILE%", process.env.USERPROFILE || "")
            : path;
        execSync(`"${testPath}" -version`, { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }) || (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"); // Last resort: hope it's in PATH
}

export default ffmpegPath;
