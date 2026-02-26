/**
 * Audio Transcription Service
 *
 * Handles audio transcription using OpenAI gpt-4o-transcribe-diarize API
 * with native speaker diarization (no separate Claude call needed).
 *
 * Flow:
 * 1. Upload audio file to OpenAI API (via Tauri command)
 * 2. Get diarized transcript with speaker labels and timestamps
 * 3. Format into readable transcript
 * 4. Return formatted transcript ready to save
 */

import { logger } from "../utils/logger";
import { getSettingJson, setSettingJson } from "./settingsService";
import { TranscriptionStatsSchema, safeParse } from "../schemas";

/**
 * Diarized segment from OpenAI API
 */
export interface DiarizedSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Transcription result with diarized output
 */
export interface TranscriptionResult {
  success: boolean;
  rawTranscript?: string;
  speakerLabeledTranscript?: string;
  speakerCount?: number;
  duration?: number; // in seconds
  segments?: DiarizedSegment[];
  cost?: {
    transcription: number; // USD
    total: number;
  };
  error?: string;
}

/**
 * Transcription options
 */
export interface TranscriptionOptions {
  speakerCount: number; // Expected number of speakers (2-4)
  language?: string; // ISO language code (e.g., 'en' for English)
  speakerLabels?: string[]; // Custom labels (e.g., ['Vet', 'Client'])
}

/**
 * Estimate transcription cost before processing
 * gpt-4o-transcribe-diarize: $0.006 per minute (diarization included)
 *
 * @param durationSeconds - Audio duration in seconds
 * @returns Estimated cost in USD
 */
export function estimateTranscriptionCost(durationSeconds: number): {
  transcription: number;
  total: number;
  // Legacy fields for backwards compatibility with UI
  whisper: number;
  claude: number;
} {
  // gpt-4o-transcribe-diarize pricing: $0.006 per minute
  const transcriptionCost = (durationSeconds / 60) * 0.006;

  return {
    transcription: parseFloat(transcriptionCost.toFixed(4)),
    total: parseFloat(transcriptionCost.toFixed(4)),
    // Legacy fields (no separate Claude cost anymore)
    whisper: parseFloat(transcriptionCost.toFixed(4)),
    claude: 0,
  };
}

/**
 * Get audio file duration (for cost estimation)
 * Uses browser Audio API to read duration without uploading
 *
 * @param file - Audio file
 * @returns Duration in seconds
 */
export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
    });
    audio.addEventListener("error", () => {
      reject(new Error("Failed to load audio file"));
    });
    audio.src = URL.createObjectURL(file);
  });
}

/**
 * Check if FFmpeg is available on the system
 */
export async function checkFFmpeg(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const version = await invoke<string>("check_ffmpeg");
    return { available: true, version };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Compress audio file using FFmpeg (mono, low bitrate, 16kHz)
 * Reduces file size significantly for transcription API
 */
async function compressAudio(
  inputPath: string,
  bitrate?: string
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("compress_audio", {
    inputPath,
    bitrate: bitrate || "64k",
  });
}

/**
 * Split audio into chunks using FFmpeg
 */
async function splitAudio(
  inputPath: string,
  chunkDurationSecs: number
): Promise<string[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string[]>("split_audio", {
    inputPath,
    chunkDurationSecs,
  });
}

/**
 * Get audio duration using FFmpeg (works for all formats)
 */
export async function getAudioDurationFFmpeg(
  filePath: string
): Promise<number> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("get_audio_duration_ffmpeg", { filePath });
}

/**
 * Progress callback for chunked transcription
 */
export type TranscriptionProgressCallback = (progress: {
  stage: "compressing" | "splitting" | "transcribing" | "merging";
  current?: number;
  total?: number;
  message: string;
}) => void;

/**
 * Transcribe audio file using OpenAI gpt-4o-transcribe-diarize
 *
 * This uses a Tauri command to handle the actual API call
 * (avoids CORS issues and keeps API key in backend)
 *
 * @param audioFilePath - Absolute path to audio file on disk
 * @param options - Transcription options (speaker count, labels, language)
 * @returns Diarized transcript with segments
 */
async function transcribeWithDiarization(
  audioFilePath: string,
  options: TranscriptionOptions
): Promise<{
  text: string;
  duration: number;
  segments: DiarizedSegment[] | null;
}> {
  const { invoke } = await import("@tauri-apps/api/core");

  // Get OpenAI API key from settings
  const { getOpenAIApiKey } = await import("./apiKeysService");
  const apiKey = await getOpenAIApiKey();

  try {
    const result = await invoke<{
      text: string;
      duration: number;
      segments: DiarizedSegment[] | null;
    }>("transcribe_audio", {
      filePath: audioFilePath,
      language: options.language || "en",
      apiKey,
      speakerNames: options.speakerLabels || null,
    });

    return result;
  } catch (error) {
    const errorStr = String(error);
    // Check if backend signals chunking is required
    if (errorStr.includes("CHUNK_REQUIRED:")) {
      throw new Error(errorStr);
    }
    logger.error("Transcription error:", error);
    throw new Error(`Transcription failed: ${error}`);
  }
}

/**
 * Transcribe a large audio file by compressing and/or splitting into chunks
 *
 * Strategy:
 * 1. Try compressing to mono 64kbps MP3 (often brings files under 25MB)
 * 2. If still >25MB, split into 15-minute chunks
 * 3. Transcribe each chunk and merge results
 */
async function transcribeWithChunking(
  audioFilePath: string,
  options: TranscriptionOptions,
  onProgress?: TranscriptionProgressCallback
): Promise<{
  text: string;
  duration: number;
  segments: DiarizedSegment[] | null;
}> {
  // Step 1: Compress the audio
  onProgress?.({
    stage: "compressing",
    message: "Compressing audio for transcription...",
  });

  let compressedPath: string;
  try {
    compressedPath = await compressAudio(audioFilePath, "64k");
  } catch (error) {
    throw new Error(
      `Failed to compress audio: ${error}. Make sure FFmpeg is installed.`
    );
  }

  // Check if compressed file is under 25MB
  const { invoke } = await import("@tauri-apps/api/core");
  const { stat } = await import("@tauri-apps/plugin-fs");

  let compressedSize: number;
  try {
    const fileInfo = await stat(compressedPath);
    compressedSize = fileInfo.size;
  } catch {
    // Fallback: try to transcribe directly (the backend will check size)
    compressedSize = 0;
  }

  const MAX_SIZE = 25 * 1024 * 1024; // 25MB

  if (compressedSize > 0 && compressedSize <= MAX_SIZE) {
    // Compressed file fits — transcribe directly
    onProgress?.({
      stage: "transcribing",
      current: 1,
      total: 1,
      message: "Transcribing compressed audio...",
    });

    return transcribeWithDiarization(compressedPath, options);
  }

  // Step 2: Split into chunks
  onProgress?.({
    stage: "splitting",
    message: "Splitting audio into chunks...",
  });

  // 15-minute chunks at 64kbps mono ≈ 7MB each (well under 25MB)
  const CHUNK_DURATION = 15 * 60; // 15 minutes in seconds
  let chunkPaths: string[];
  try {
    chunkPaths = await splitAudio(audioFilePath, CHUNK_DURATION);
  } catch (error) {
    throw new Error(
      `Failed to split audio: ${error}. Make sure FFmpeg is installed.`
    );
  }

  // Step 3: Transcribe each chunk
  const allSegments: DiarizedSegment[] = [];
  let fullText = "";
  let totalDuration = 0;

  for (let i = 0; i < chunkPaths.length; i++) {
    onProgress?.({
      stage: "transcribing",
      current: i + 1,
      total: chunkPaths.length,
      message: `Transcribing chunk ${i + 1} of ${chunkPaths.length}...`,
    });

    const chunkResult = await transcribeWithDiarization(chunkPaths[i], options);

    // Adjust segment timestamps based on chunk offset
    const chunkOffset = i * CHUNK_DURATION;
    if (chunkResult.segments) {
      for (const seg of chunkResult.segments) {
        allSegments.push({
          ...seg,
          start: seg.start + chunkOffset,
          end: seg.end + chunkOffset,
        });
      }
    }

    fullText += (fullText ? " " : "") + chunkResult.text;
    totalDuration += chunkResult.duration;
  }

  // Step 4: Merge
  onProgress?.({
    stage: "merging",
    message: "Merging transcription results...",
  });

  return {
    text: fullText,
    duration: totalDuration,
    segments: allSegments.length > 0 ? allSegments : null,
  };
}

/**
 * Format diarized segments into a readable transcript with speaker labels
 *
 * @param segments - Diarized segments from OpenAI
 * @param speakerLabels - Optional custom labels to replace generic "Speaker 1" etc.
 * @returns Formatted transcript string
 */
function formatDiarizedTranscript(
  segments: DiarizedSegment[],
  speakerLabels?: string[]
): { transcript: string; speakerCount: number } {
  if (segments.length === 0) {
    return { transcript: "", speakerCount: 0 };
  }

  // Collect unique speaker IDs from the API response
  const uniqueSpeakers = [...new Set(segments.map((s) => s.speaker))];

  // Build a mapping from API speaker IDs to custom labels
  const speakerMap = new Map<string, string>();
  if (speakerLabels && speakerLabels.length > 0) {
    uniqueSpeakers.forEach((apiSpeaker, index) => {
      speakerMap.set(
        apiSpeaker,
        index < speakerLabels.length ? speakerLabels[index] : apiSpeaker
      );
    });
  }

  // Format segments into readable transcript
  // Merge consecutive segments from the same speaker
  const lines: string[] = [];
  let currentSpeaker = "";
  let currentText = "";

  for (const segment of segments) {
    const label = speakerMap.get(segment.speaker) || segment.speaker;

    if (label !== currentSpeaker) {
      // New speaker - flush previous
      if (currentSpeaker && currentText) {
        lines.push(`${currentSpeaker}: ${currentText.trim()}`);
        lines.push(""); // blank line between speakers
      }
      currentSpeaker = label;
      currentText = segment.text;
    } else {
      // Same speaker - append
      currentText += " " + segment.text;
    }
  }

  // Flush last speaker
  if (currentSpeaker && currentText) {
    lines.push(`${currentSpeaker}: ${currentText.trim()}`);
  }

  return {
    transcript: lines.join("\n"),
    speakerCount: uniqueSpeakers.length,
  };
}

/**
 * Main transcription function
 *
 * Orchestrates the full transcription pipeline:
 * 1. Try direct transcription via OpenAI gpt-4o-transcribe-diarize
 * 2. If file >25MB, automatically compress/split via FFmpeg and transcribe chunks
 * 3. Format diarized output with custom labels
 * 4. Cost calculation
 *
 * @param audioFilePath - Absolute path to audio file
 * @param options - Transcription options
 * @param onProgress - Optional progress callback for chunked transcription
 * @returns Transcription result with labeled transcript
 */
export async function transcribeAudio(
  audioFilePath: string,
  options: TranscriptionOptions,
  onProgress?: TranscriptionProgressCallback
): Promise<TranscriptionResult> {
  try {
    logger.debug(
      "Starting transcription with gpt-4o-transcribe-diarize..."
    );

    let result: {
      text: string;
      duration: number;
      segments: DiarizedSegment[] | null;
    };

    try {
      // Try direct transcription first
      result = await transcribeWithDiarization(audioFilePath, options);
    } catch (error) {
      const errorStr = String(error);

      // If backend signals chunking is required (file >25MB)
      if (errorStr.includes("CHUNK_REQUIRED:")) {
        logger.debug("File >25MB, using FFmpeg chunking...");

        // Check FFmpeg availability
        const ffmpegCheck = await checkFFmpeg();
        if (!ffmpegCheck.available) {
          return {
            success: false,
            error:
              "This audio file is larger than 25MB and requires FFmpeg for processing. Please install FFmpeg (https://ffmpeg.org) and ensure it is in your system PATH.",
          };
        }

        // Use chunking pipeline
        result = await transcribeWithChunking(
          audioFilePath,
          options,
          onProgress
        );
      } else {
        throw error;
      }
    }

    if (!result.text || result.text.trim().length === 0) {
      return {
        success: false,
        error: "Transcription returned empty result",
      };
    }

    logger.debug(`Transcription completed. Duration: ${result.duration}s`);

    // Format the diarized segments into a readable transcript
    let speakerLabeledTranscript = result.text;
    let speakerCount = 1;

    if (result.segments && result.segments.length > 0) {
      const formatted = formatDiarizedTranscript(
        result.segments,
        options.speakerLabels
      );
      speakerLabeledTranscript = formatted.transcript;
      speakerCount = formatted.speakerCount;
      logger.debug(
        `Formatted ${result.segments.length} segments from ${speakerCount} speakers`
      );
    }

    // Calculate cost - single API call, no separate Claude cost
    const transcriptionCost = (result.duration / 60) * 0.006;

    return {
      success: true,
      rawTranscript: result.text,
      speakerLabeledTranscript,
      speakerCount,
      duration: result.duration,
      segments: result.segments || undefined,
      cost: {
        transcription: parseFloat(transcriptionCost.toFixed(4)),
        total: parseFloat(transcriptionCost.toFixed(4)),
      },
    };
  } catch (error) {
    logger.error("Transcription error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Save transcript to file
 *
 * @param transcript - Transcript text to save
 * @param filePath - Absolute path where to save the transcript
 * @returns Success status
 */
export async function saveTranscript(
  transcript: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const { invoke } = await import("@tauri-apps/api/core");

  try {
    await invoke("write_text_file", {
      filePath,
      content: transcript,
    });

    return { success: true };
  } catch (error) {
    logger.error("Save transcript error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get transcription usage statistics
 *
 * Tracks total transcriptions and costs for user reference
 */
export interface TranscriptionStats {
  totalTranscriptions: number;
  totalDuration: number; // seconds
  totalCost: number; // USD
  lastTranscription?: string; // ISO date
}

const STATS_KEY = "pbs_admin_transcription_stats";

const DEFAULT_STATS: TranscriptionStats = {
  totalTranscriptions: 0,
  totalDuration: 0,
  totalCost: 0,
};

export async function getTranscriptionStats(): Promise<TranscriptionStats> {
  const raw = await getSettingJson<TranscriptionStats>(STATS_KEY, DEFAULT_STATS);
  return safeParse(TranscriptionStatsSchema, raw, DEFAULT_STATS, "transcription stats");
}

export async function updateTranscriptionStats(
  duration: number,
  cost: number
): Promise<void> {
  const stats = await getTranscriptionStats();

  const updated: TranscriptionStats = {
    totalTranscriptions: stats.totalTranscriptions + 1,
    totalDuration: stats.totalDuration + duration,
    totalCost: stats.totalCost + cost,
    lastTranscription: new Date().toISOString(),
  };

  await setSettingJson(STATS_KEY, updated);
}
