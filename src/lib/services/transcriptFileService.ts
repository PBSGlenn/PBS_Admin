// PBS Admin - Transcript File Management Service
// Handle saving and reading consultation transcripts

import { invoke } from "@tauri-apps/api/core";
import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import { format } from "date-fns";

export interface TranscriptSaveResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

/**
 * Save transcript to client folder
 * Filename format: {surname}_{YYYYMMDD}_transcript.txt
 */
export async function saveTranscriptFile(
  clientFolderPath: string,
  clientSurname: string,
  consultationDate: string,
  transcriptContent: string
): Promise<TranscriptSaveResult> {
  try {
    // Validate client folder exists
    if (!clientFolderPath) {
      return {
        success: false,
        error: "Client folder path is not set"
      };
    }

    const folderExists = await exists(clientFolderPath);
    if (!folderExists) {
      return {
        success: false,
        error: "Client folder does not exist"
      };
    }

    // Generate filename
    const dateForFilename = format(new Date(consultationDate), "yyyyMMdd");
    const fileName = `${clientSurname.toLowerCase()}_${dateForFilename}_transcript.txt`;
    const filePath = `${clientFolderPath}\\${fileName}`;

    // Check if file already exists
    const fileExists = await exists(filePath);
    if (fileExists) {
      // Add version number if file exists
      let version = 2;
      let versionedFileName = `${clientSurname.toLowerCase()}_${dateForFilename}_transcript_v${version}.txt`;
      let versionedFilePath = `${clientFolderPath}\\${versionedFileName}`;

      while (await exists(versionedFilePath)) {
        version++;
        versionedFileName = `${clientSurname.toLowerCase()}_${dateForFilename}_transcript_v${version}.txt`;
        versionedFilePath = `${clientFolderPath}\\${versionedFileName}`;
      }

      // Save with version number
      await invoke("write_text_file", {
        filePath: versionedFilePath,
        content: transcriptContent
      });

      return {
        success: true,
        filePath: versionedFilePath,
        fileName: versionedFileName
      };
    }

    // Save transcript file
    await invoke("write_text_file", {
      filePath,
      content: transcriptContent
    });

    return {
      success: true,
      filePath,
      fileName
    };
  } catch (error) {
    console.error("Failed to save transcript:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Read transcript from saved file
 */
export async function readTranscriptFile(filePath: string): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  try {
    // Check if file exists
    const fileExists = await exists(filePath);
    if (!fileExists) {
      return {
        success: false,
        error: "Transcript file not found"
      };
    }

    // Read file content
    const content = await readTextFile(filePath);

    return {
      success: true,
      content
    };
  } catch (error) {
    console.error("Failed to read transcript:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Copy questionnaire JSON file to client folder
 * Filename format: {surname}_{YYYYMMDD}_questionnaire.json
 */
export async function copyQuestionnaireFile(
  sourcePath: string,
  clientFolderPath: string,
  clientSurname: string,
  consultationDate: string
): Promise<TranscriptSaveResult> {
  try {
    // Validate paths
    if (!clientFolderPath) {
      return {
        success: false,
        error: "Client folder path is not set"
      };
    }

    const sourceExists = await exists(sourcePath);
    if (!sourceExists) {
      return {
        success: false,
        error: "Source questionnaire file not found"
      };
    }

    const folderExists = await exists(clientFolderPath);
    if (!folderExists) {
      return {
        success: false,
        error: "Client folder does not exist"
      };
    }

    // Read source file
    const content = await readTextFile(sourcePath);

    // Generate filename
    const dateForFilename = format(new Date(consultationDate), "yyyyMMdd");
    const fileName = `${clientSurname.toLowerCase()}_${dateForFilename}_questionnaire.json`;
    const destPath = `${clientFolderPath}\\${fileName}`;

    // Check if file already exists
    const fileExists = await exists(destPath);
    if (fileExists) {
      // Add version number if file exists
      let version = 2;
      let versionedFileName = `${clientSurname.toLowerCase()}_${dateForFilename}_questionnaire_v${version}.json`;
      let versionedFilePath = `${clientFolderPath}\\${versionedFileName}`;

      while (await exists(versionedFilePath)) {
        version++;
        versionedFileName = `${clientSurname.toLowerCase()}_${dateForFilename}_questionnaire_v${version}.json`;
        versionedFilePath = `${clientFolderPath}\\${versionedFileName}`;
      }

      // Save with version number
      await invoke("write_text_file", {
        filePath: versionedFilePath,
        content
      });

      return {
        success: true,
        filePath: versionedFilePath,
        fileName: versionedFileName
      };
    }

    // Save file
    await invoke("write_text_file", {
      filePath: destPath,
      content
    });

    return {
      success: true,
      filePath: destPath,
      fileName
    };
  } catch (error) {
    console.error("Failed to copy questionnaire:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * List available questionnaire files in client folder
 * Used for dropdown selection
 */
export async function listQuestionnaireFiles(
  clientFolderPath: string
): Promise<{
  success: boolean;
  files?: Array<{ name: string; path: string }>;
  error?: string;
}> {
  try {
    if (!clientFolderPath) {
      return {
        success: false,
        error: "Client folder path is not set"
      };
    }

    const folderExists = await exists(clientFolderPath);
    if (!folderExists) {
      return {
        success: true,
        files: []
      };
    }

    // Read directory
    const entries = await invoke<Array<{ name: string; isDirectory: boolean }>>(
      "plugin:fs|read_dir",
      { path: clientFolderPath }
    );

    // Filter for JSON files (questionnaires)
    const questionnaireFiles = entries
      .filter(entry => !entry.isDirectory && entry.name.endsWith('.json'))
      .filter(entry => entry.name.includes('questionnaire'))
      .map(entry => ({
        name: entry.name,
        path: `${clientFolderPath}\\${entry.name}`
      }));

    return {
      success: true,
      files: questionnaireFiles
    };
  } catch (error) {
    console.error("Failed to list questionnaires:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Check if transcript file exists for event
 */
export async function transcriptFileExists(filePath: string | null): Promise<boolean> {
  if (!filePath) return false;

  try {
    return await exists(filePath);
  } catch {
    return false;
  }
}

/**
 * Validate transcript content
 * Returns validation errors if any
 */
export function validateTranscriptContent(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push("Transcript cannot be empty");
  }

  if (content.trim().length < 100) {
    errors.push("Transcript seems too short (minimum 100 characters)");
  }

  if (content.length > 1_000_000) {
    errors.push("Transcript is too large (maximum 1MB)");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
