/**
 * Audio Transcription Service
 *
 * Handles audio transcription using OpenAI Whisper API
 * with Claude-powered speaker diarization inference.
 *
 * Flow:
 * 1. Upload audio file to OpenAI Whisper API (via Tauri command)
 * 2. Get raw transcript with timestamps
 * 3. Use Claude to add speaker labels based on context
 * 4. Return formatted transcript ready to save
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Transcription result with both raw and speaker-labeled versions
 */
export interface TranscriptionResult {
  success: boolean;
  rawTranscript?: string;
  speakerLabeledTranscript?: string;
  speakerCount?: number;
  duration?: number; // in seconds
  cost?: {
    whisper: number; // USD
    claude: number; // USD
    total: number;
  };
  error?: string;
}

/**
 * Transcription options
 */
export interface TranscriptionOptions {
  speakerCount: number; // Expected number of speakers (2-5)
  language?: string; // ISO language code (e.g., 'en' for English)
  speakerLabels?: string[]; // Custom labels (e.g., ['Vet', 'Client'] or ['Vet', 'Client', 'Partner'])
}

/**
 * Estimate transcription cost before processing
 *
 * @param durationSeconds - Audio duration in seconds
 * @returns Estimated cost in USD
 */
export function estimateTranscriptionCost(durationSeconds: number): {
  whisper: number;
  claude: number;
  total: number;
} {
  // OpenAI Whisper pricing: $0.006 per minute
  const whisperCost = (durationSeconds / 60) * 0.006;

  // Claude cost for speaker labeling (rough estimate):
  // ~500 tokens per minute of transcript
  // Input: transcript + system prompt (~2000 tokens base)
  // Output: labeled transcript (~500 tokens per minute)
  const estimatedInputTokens = 2000 + (durationSeconds / 60) * 500;
  const estimatedOutputTokens = (durationSeconds / 60) * 500;

  // Claude Sonnet 4.5 pricing (as of March 2024)
  const inputCostPerMillion = 3.0;
  const outputCostPerMillion = 15.0;

  const claudeCost =
    (estimatedInputTokens / 1_000_000) * inputCostPerMillion +
    (estimatedOutputTokens / 1_000_000) * outputCostPerMillion;

  return {
    whisper: parseFloat(whisperCost.toFixed(4)),
    claude: parseFloat(claudeCost.toFixed(4)),
    total: parseFloat((whisperCost + claudeCost).toFixed(4))
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
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      reject(new Error('Failed to load audio file'));
    });
    audio.src = URL.createObjectURL(file);
  });
}

/**
 * Transcribe audio file using OpenAI Whisper API
 *
 * This uses a Tauri command to handle the actual API call
 * (avoids CORS issues and keeps API key in backend)
 *
 * @param audioFilePath - Absolute path to audio file on disk
 * @param language - Optional language code (defaults to 'en')
 * @returns Raw transcript text
 */
async function transcribeWithWhisper(
  audioFilePath: string,
  language: string = 'en'
): Promise<{ text: string; duration: number }> {
  const { invoke } = await import("@tauri-apps/api/core");

  try {
    const result = await invoke<{ text: string; duration: number }>(
      "transcribe_audio",
      {
        filePath: audioFilePath,
        language
      }
    );

    return result;
  } catch (error) {
    console.error("Whisper transcription error:", error);
    throw new Error(`Transcription failed: ${error}`);
  }
}

/**
 * Add speaker labels to transcript using Claude
 *
 * Uses Claude Sonnet 4.5 to infer speaker identities based on
 * consultation context and conversation patterns.
 *
 * @param rawTranscript - Raw transcript from Whisper
 * @param options - Transcription options (speaker count, labels)
 * @returns Speaker-labeled transcript
 */
async function addSpeakerLabels(
  rawTranscript: string,
  options: TranscriptionOptions
): Promise<{ transcript: string; tokensUsed: { input: number; output: number } }> {
  const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  });

  // Default speaker labels based on count
  const defaultLabels: Record<number, string[]> = {
    2: ['Vet', 'Client'],
    3: ['Vet', 'Client', 'Partner'],
    4: ['Vet', 'Client', 'Partner', 'Family Member'],
    5: ['Vet', 'Client', 'Partner', 'Family Member 1', 'Family Member 2']
  };

  const speakerLabels = options.speakerLabels || defaultLabels[options.speakerCount] || defaultLabels[2];

  const systemPrompt = `You are a transcript formatting assistant. Your task is to add speaker labels to veterinary behavioral consultation transcripts.

## Context
- This is a consultation between a veterinary behaviorist and a client (pet owner)
- There are ${options.speakerCount} speakers in this conversation
- The speakers are: ${speakerLabels.join(', ')}

## Conversation Patterns
- ${speakerLabels[0]} (veterinarian) typically:
  - Asks diagnostic questions about pet behavior
  - Explains behavioral principles and theories
  - Provides professional advice and recommendations
  - Uses technical/medical terminology
  - Listens and takes notes

- ${speakerLabels[1]} (client/pet owner) typically:
  - Describes pet's problem behaviors
  - Shares anecdotes and examples
  - Asks clarifying questions
  - Expresses concerns and emotions
  - Discusses home environment

${options.speakerCount > 2 ? `- Additional speakers (${speakerLabels.slice(2).join(', ')}) typically contribute to the discussion about the pet's behavior and home environment.` : ''}

## Instructions
1. Read through the entire transcript to understand the flow
2. Identify speaker changes based on:
   - Content (diagnostic questions vs. problem descriptions)
   - Speaking style (professional vs. conversational)
   - Topic shifts (questions vs. answers)
3. Add speaker labels in the format "SpeakerName: "
4. Preserve all original text exactly as transcribed
5. Add paragraph breaks at natural speaker changes for readability

## Output Format
Return ONLY the labeled transcript. Do not add any commentary, explanations, or notes.

Example output format:
Vet: Good morning! Thanks for coming in today. Can you tell me what brings you here?

Client: Hi, yes. Our dog Max has been showing some really concerning aggression toward visitors. It started about three months ago.

Vet: I see. And when you say aggression, can you describe exactly what behaviors you're seeing?

[Continue in this format...]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is the raw transcript to label:\n\n${rawTranscript}`
        }
      ]
    });

    const labeledTranscript = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return {
      transcript: labeledTranscript,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens
      }
    };
  } catch (error) {
    console.error("Claude speaker labeling error:", error);
    throw new Error(`Speaker labeling failed: ${error}`);
  }
}

/**
 * Main transcription function
 *
 * Orchestrates the full transcription pipeline:
 * 1. Whisper API transcription
 * 2. Claude speaker labeling
 * 3. Cost calculation
 *
 * @param audioFilePath - Absolute path to audio file
 * @param options - Transcription options
 * @returns Transcription result with both raw and labeled transcripts
 */
export async function transcribeAudio(
  audioFilePath: string,
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  try {
    // Step 1: Transcribe with Whisper
    console.log("Starting Whisper transcription...");
    const whisperResult = await transcribeWithWhisper(
      audioFilePath,
      options.language || 'en'
    );

    if (!whisperResult.text || whisperResult.text.trim().length === 0) {
      return {
        success: false,
        error: "Whisper returned empty transcript"
      };
    }

    console.log(`Whisper completed. Duration: ${whisperResult.duration}s`);

    // Step 2: Add speaker labels with Claude
    console.log("Adding speaker labels with Claude...");
    const claudeResult = await addSpeakerLabels(whisperResult.text, options);

    console.log("Speaker labeling completed.");

    // Step 3: Calculate actual costs
    const whisperCost = (whisperResult.duration / 60) * 0.006;
    const claudeCost =
      (claudeResult.tokensUsed.input / 1_000_000) * 3.0 +
      (claudeResult.tokensUsed.output / 1_000_000) * 15.0;

    return {
      success: true,
      rawTranscript: whisperResult.text,
      speakerLabeledTranscript: claudeResult.transcript,
      speakerCount: options.speakerCount,
      duration: whisperResult.duration,
      cost: {
        whisper: parseFloat(whisperCost.toFixed(4)),
        claude: parseFloat(claudeCost.toFixed(4)),
        total: parseFloat((whisperCost + claudeCost).toFixed(4))
      }
    };

  } catch (error) {
    console.error("Transcription error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
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
      content: transcript
    });

    return { success: true };
  } catch (error) {
    console.error("Save transcript error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get transcription usage statistics from localStorage
 *
 * Tracks total transcriptions and costs for user reference
 */
export interface TranscriptionStats {
  totalTranscriptions: number;
  totalDuration: number; // seconds
  totalCost: number; // USD
  lastTranscription?: string; // ISO date
}

const STATS_KEY = 'pbs_admin_transcription_stats';

export function getTranscriptionStats(): TranscriptionStats {
  const stored = localStorage.getItem(STATS_KEY);
  if (!stored) {
    return {
      totalTranscriptions: 0,
      totalDuration: 0,
      totalCost: 0
    };
  }

  try {
    return JSON.parse(stored);
  } catch {
    return {
      totalTranscriptions: 0,
      totalDuration: 0,
      totalCost: 0
    };
  }
}

export function updateTranscriptionStats(
  duration: number,
  cost: number
): void {
  const stats = getTranscriptionStats();

  const updated: TranscriptionStats = {
    totalTranscriptions: stats.totalTranscriptions + 1,
    totalDuration: stats.totalDuration + duration,
    totalCost: stats.totalCost + cost,
    lastTranscription: new Date().toISOString()
  };

  localStorage.setItem(STATS_KEY, JSON.stringify(updated));
}
