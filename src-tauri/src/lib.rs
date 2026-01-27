// PBS Admin - Tauri Application Entry Point

use std::fs;
use std::path::{Path, PathBuf};
use std::io::Write;
use std::process::Command;
use reqwest::blocking::get;
use serde::{Deserialize, Serialize};

// ============================================================================
// PATH VALIDATION FOR SECURITY
// ============================================================================

/// Get the base PBS_Admin directory in Documents
fn get_pbs_admin_base_path() -> Result<PathBuf, String> {
    match dirs::document_dir() {
        Some(docs_path) => Ok(docs_path.join("PBS_Admin")),
        None => Err("Could not find Documents folder".to_string()),
    }
}

/// Validate that a path is within allowed directories (PBS_Admin folder structure)
/// This prevents directory traversal attacks (e.g., ../../../etc/passwd)
fn validate_path_within_pbs_admin(path: &str) -> Result<PathBuf, String> {
    let path_obj = Path::new(path);

    // Canonicalize to resolve any ../ or symlinks
    let canonical_path = match path_obj.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            // If path doesn't exist yet (for new files), check parent
            if let Some(parent) = path_obj.parent() {
                let canonical_parent = parent.canonicalize()
                    .map_err(|_| format!("Invalid path: parent directory does not exist: {}", path))?;
                // Reconstruct full path with canonical parent
                let file_name = path_obj.file_name()
                    .ok_or_else(|| format!("Invalid path: no file name: {}", path))?;
                canonical_parent.join(file_name)
            } else {
                return Err(format!("Invalid path: {}", path));
            }
        }
    };

    // Get the allowed base path
    let base_path = get_pbs_admin_base_path()?;
    let canonical_base = base_path.canonicalize()
        .unwrap_or(base_path); // If base doesn't exist, use non-canonical

    // Also allow system temp directory for temp files
    let temp_dir = std::env::temp_dir();
    let temp_pbs = temp_dir.join("PBS_Admin");

    // Check if path is within allowed directories
    if canonical_path.starts_with(&canonical_base) || canonical_path.starts_with(&temp_pbs) {
        Ok(canonical_path)
    } else {
        Err(format!(
            "Access denied: path '{}' is outside allowed directory. Files must be within Documents/PBS_Admin/",
            path
        ))
    }
}

/// Validate path for read operations (file must exist within allowed dirs)
fn validate_read_path(path: &str) -> Result<PathBuf, String> {
    let path_obj = Path::new(path);

    if !path_obj.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    validate_path_within_pbs_admin(path)
}

/// Validate path for write operations (parent must exist within allowed dirs)
fn validate_write_path(path: &str) -> Result<PathBuf, String> {
    validate_path_within_pbs_admin(path)
}

// ============================================================================
// DATABASE PATH
// ============================================================================

/// Get the database path (Tauri command for frontend)
#[tauri::command]
fn get_database_path() -> Result<String, String> {
    match dirs::document_dir() {
        Some(docs_path) => {
            let data_dir = docs_path.join("PBS_Admin").join("data");
            if !data_dir.exists() {
                fs::create_dir_all(&data_dir)
                    .map_err(|e| format!("Failed to create data directory: {}", e))?;
            }
            let db_path = data_dir.join("pbs_admin.db");
            Ok(db_path.to_string_lossy().to_string())
        },
        None => Err("Could not find Documents folder".to_string()),
    }
}

/// Internal function to get database path for backup operations
fn get_database_path_internal() -> Result<PathBuf, String> {
    match dirs::document_dir() {
        Some(docs_path) => {
            let db_path = docs_path.join("PBS_Admin").join("data").join("pbs_admin.db");
            if !db_path.exists() {
                return Err(format!("Database not found at: {}", db_path.display()));
            }
            Ok(db_path)
        },
        None => Err("Could not find Documents folder".to_string()),
    }
}

// ============================================================================
// FILE AND FOLDER OPERATIONS
// ============================================================================

#[tauri::command]
fn create_folder(path: String) -> Result<String, String> {
    // Validate path is within allowed directories
    // For folder creation, we need to check the parent path
    let folder_path = Path::new(&path);

    // Check if folder already exists
    if folder_path.exists() {
        return Err(format!("Folder already exists: {}", path));
    }

    // Validate parent directory is within PBS_Admin
    if let Some(parent) = folder_path.parent() {
        let base_path = get_pbs_admin_base_path()?;
        let canonical_parent = parent.canonicalize()
            .map_err(|_| format!("Parent directory does not exist: {}", parent.display()))?;
        let canonical_base = base_path.canonicalize().unwrap_or(base_path);

        if !canonical_parent.starts_with(&canonical_base) {
            return Err(format!(
                "Access denied: cannot create folder outside Documents/PBS_Admin/: {}",
                path
            ));
        }
    }

    // Create the folder
    match fs::create_dir_all(folder_path) {
        Ok(_) => Ok(path.clone()),
        Err(e) => Err(format!("Failed to create folder: {}", e)),
    }
}

#[tauri::command]
fn get_default_client_records_path() -> Result<String, String> {
    // Get user's Documents folder
    match dirs::document_dir() {
        Some(docs_path) => {
            let client_records_path = docs_path.join("PBS_Admin").join("Client_Records");

            // Ensure the base directory exists
            if !client_records_path.exists() {
                fs::create_dir_all(&client_records_path)
                    .map_err(|e| format!("Failed to create base directory: {}", e))?;
            }

            Ok(client_records_path.to_string_lossy().to_string())
        },
        None => Err("Could not find Documents folder".to_string()),
    }
}

#[tauri::command]
fn read_text_file(file_path: String) -> Result<String, String> {
    // Validate path is within allowed directories
    let validated_path = validate_read_path(&file_path)?;

    // Read file content
    match fs::read_to_string(&validated_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<String, String> {
    // Validate path is within allowed directories
    let validated_path = validate_write_path(&file_path)?;

    // Ensure parent directory exists
    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Write content to file
    match fs::File::create(&validated_path) {
        Ok(mut file) => {
            file.write_all(content.as_bytes())
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(file_path.clone())
        },
        Err(e) => Err(format!("Failed to create file: {}", e)),
    }
}

#[tauri::command]
fn write_binary_file(file_path: String, data: Vec<u8>) -> Result<String, String> {
    // Validate path is within allowed directories
    let validated_path = validate_write_path(&file_path)?;

    // Ensure parent directory exists
    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Write binary data to file
    match fs::File::create(&validated_path) {
        Ok(mut file) => {
            file.write_all(&data)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(file_path.clone())
        },
        Err(e) => Err(format!("Failed to create file: {}", e)),
    }
}

#[tauri::command]
fn download_file(url: String, file_path: String) -> Result<String, String> {
    // Validate path is within allowed directories
    let validated_path = validate_write_path(&file_path)?;

    // Ensure parent directory exists
    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Download file from URL
    let response = get(&url)
        .map_err(|e| format!("Failed to download file: {}", e))?;

    // Check response status
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    // Get response body as bytes
    let bytes = response.bytes()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Write to file
    match fs::File::create(&validated_path) {
        Ok(mut file) => {
            file.write_all(&bytes)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(file_path.clone())
        },
        Err(e) => Err(format!("Failed to create file: {}", e)),
    }
}

#[tauri::command]
fn list_files(directory: String, pattern: Option<String>) -> Result<Vec<String>, String> {
    // Validate directory is within allowed paths
    let validated_dir = validate_read_path(&directory)?;

    if !validated_dir.is_dir() {
        return Err(format!("Path is not a directory: {}", directory));
    }

    // Read directory entries
    let entries = fs::read_dir(&validated_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Only include files (not directories)
        if path.is_file() {
            if let Some(file_name) = path.file_name() {
                let file_name_str = file_name.to_string_lossy().to_string();

                // Apply pattern filter if provided
                if let Some(ref pattern_str) = pattern {
                    if file_name_str.contains(pattern_str) {
                        files.push(path.to_string_lossy().to_string());
                    }
                } else {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(files)
}

#[tauri::command]
fn get_templates_path() -> Result<String, String> {
    // Get user's Documents folder
    match dirs::document_dir() {
        Some(docs_path) => {
            let templates_path = docs_path.join("PBS_Admin").join("Templates");

            // Ensure the directory exists
            if !templates_path.exists() {
                fs::create_dir_all(&templates_path)
                    .map_err(|e| format!("Failed to create templates directory: {}", e))?;
            }

            Ok(templates_path.to_string_lossy().to_string())
        },
        None => Err("Could not find Documents folder".to_string()),
    }
}

#[tauri::command]
fn run_pandoc(input_path: String, output_path: String, template_path: Option<String>) -> Result<String, String> {
    // Build pandoc command
    let mut cmd = Command::new("pandoc");

    // Add input file
    cmd.arg(&input_path);

    // Use hard_line_breaks extension to preserve markdown line breaks
    cmd.arg("-f");
    cmd.arg("markdown+hard_line_breaks");

    // Add output file
    cmd.arg("-o");
    cmd.arg(&output_path);

    // Add reference document (template) if provided
    // Note: The template's letterhead MUST be in the Word Header section (Insert > Header)
    // not in the document body, for Pandoc --reference-doc to apply it correctly
    if let Some(ref template) = template_path {
        // Check if template file exists
        let template_path_obj = std::path::Path::new(template);
        if template_path_obj.exists() {
            println!("Using reference document template: {}", template);
            cmd.arg("--reference-doc");
            cmd.arg(template);
        } else {
            return Err(format!(
                "Template file not found: {}. Please ensure the letterhead template exists in Documents\\PBS_Admin\\Templates\\",
                template
            ));
        }
    }

    // Execute command
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute pandoc: {}. Is pandoc installed?", e))?;

    // Check if command succeeded
    if output.status.success() {
        Ok(output_path.clone())
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Pandoc conversion failed: {}", error_msg))
    }
}

#[tauri::command]
fn run_pandoc_from_stdin(markdown_content: String, output_path: String, template_path: Option<String>) -> Result<String, String> {
    use std::process::Stdio;

    // Build pandoc command with stdin input
    let mut cmd = Command::new("pandoc");
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Read from stdin (dash means read from stdin)
    cmd.arg("-");

    // Use hard_line_breaks extension to preserve markdown line breaks
    cmd.arg("-f");
    cmd.arg("markdown+hard_line_breaks");

    // Add output file
    cmd.arg("-o");
    cmd.arg(&output_path);

    // Add reference document (template) if provided
    // Note: The template's letterhead MUST be in the Word Header section (Insert > Header)
    // not in the document body, for Pandoc --reference-doc to apply it correctly
    if let Some(ref template) = template_path {
        // Check if template file exists
        let template_path_obj = std::path::Path::new(template);
        if template_path_obj.exists() {
            println!("Using reference document template: {}", template);
            cmd.arg("--reference-doc");
            cmd.arg(template);
        } else {
            return Err(format!(
                "Template file not found: {}. Please ensure the letterhead template exists in Documents\\PBS_Admin\\Templates\\",
                template
            ));
        }
    }

    // Spawn process
    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn pandoc: {}. Is pandoc installed?", e))?;

    // Write markdown content to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(markdown_content.as_bytes())
            .map_err(|e| format!("Failed to write to pandoc stdin: {}", e))?;
    }

    // Wait for process to complete
    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for pandoc: {}", e))?;

    // Check if command succeeded
    if output.status.success() {
        Ok(output_path.clone())
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Pandoc conversion failed: {}", error_msg))
    }
}

#[tauri::command]
fn convert_docx_to_pdf(docx_path: String, pdf_path: String) -> Result<String, String> {
    // Build PowerShell script for Word COM automation
    // IMPORTANT: The DOCX file MUST be closed in Word before conversion
    // If the file is open, Word COM will hang trying to access it
    let ps_script = format!(
        r#"
$ErrorActionPreference = "Stop"
$word = $null
try {{
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    # Open document: FileName, ConfirmConversions, ReadOnly
    # ReadOnly=$true helps avoid conflicts if file is somehow locked
    $doc = $word.Documents.Open("{}", $false, $true)

    # Save as PDF (17 = wdFormatPDF)
    $doc.SaveAs("{}", 17)
    $doc.Close($false)
    Write-Output "Success"
}} catch {{
    Write-Error "PDF conversion failed: $($_.Exception.Message)"
    exit 1
}} finally {{
    if ($word -ne $null) {{
        try {{ $word.Quit() }} catch {{ }}
        try {{ [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null }} catch {{ }}
    }}
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}}
"#,
        docx_path.replace("\\", "\\\\"),
        pdf_path.replace("\\", "\\\\")
    );

    // Execute PowerShell script
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

    // Check if command succeeded
    if output.status.success() {
        Ok(pdf_path.clone())
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        // Provide helpful error message if file might be locked
        if error_msg.contains("locked") || error_msg.contains("being used") || error_msg.contains("access") {
            Err(format!("PDF conversion failed - the DOCX file may be open in Word. Please close it and try again. Error: {}", error_msg))
        } else {
            Err(format!("PDF conversion failed: {}", error_msg))
        }
    }
}

// Transcription-related structures
#[derive(Serialize, Deserialize)]
struct TranscriptionResponse {
    text: String,
}

#[derive(Serialize)]
struct TranscribeResult {
    text: String,
    duration: f64,
}

/// Save uploaded audio file to temp directory for processing
#[tauri::command]
fn save_temp_audio_file(file_name: String, file_data: Vec<u8>) -> Result<String, String> {
    // Get system temp directory
    let temp_dir = std::env::temp_dir();
    let pbs_temp = temp_dir.join("PBS_Admin");

    // Create PBS_Admin temp folder if it doesn't exist
    if !pbs_temp.exists() {
        fs::create_dir_all(&pbs_temp)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }

    // Create unique filename with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let safe_name = file_name.replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "_");
    let temp_file_path = pbs_temp.join(format!("{}_{}", timestamp, safe_name));

    // Write file data
    match fs::File::create(&temp_file_path) {
        Ok(mut file) => {
            file.write_all(&file_data)
                .map_err(|e| format!("Failed to write temp file: {}", e))?;
            Ok(temp_file_path.to_string_lossy().to_string())
        },
        Err(e) => Err(format!("Failed to create temp file: {}", e)),
    }
}

/// Transcribe audio using OpenAI Whisper API
#[tauri::command]
async fn transcribe_audio(file_path: String, language: String) -> Result<TranscribeResult, String> {
    println!("Transcribing audio file: {}", file_path);

    // Get OpenAI API key from environment
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable not set".to_string())?;

    println!("API key found: {}...", &api_key[..10]);

    // Read audio file
    let file_data = fs::read(&file_path)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;

    let file_size = file_data.len();
    println!("Audio file size: {} bytes", file_size);

    // Check file size limit (OpenAI Whisper API has 25MB limit)
    const MAX_FILE_SIZE: usize = 25 * 1024 * 1024; // 25MB in bytes
    if file_size > MAX_FILE_SIZE {
        let mb = file_size as f64 / 1_024_000.0;
        return Err(format!(
            "Audio file is too large ({:.1} MB). OpenAI Whisper API has a 25MB limit. Please compress the audio file or split it into smaller segments.",
            mb
        ));
    }

    // Get file name from path
    let file_name = Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.m4a")
        .to_string();

    // Determine MIME type based on file extension
    let mime_type = if file_name.ends_with(".m4a") {
        "audio/mp4"
    } else if file_name.ends_with(".mp3") {
        "audio/mpeg"
    } else if file_name.ends_with(".wav") {
        "audio/wav"
    } else {
        "audio/mpeg" // default
    };

    // Create multipart form
    let part = reqwest::multipart::Part::bytes(file_data)
        .file_name(file_name)
        .mime_str(mime_type)
        .map_err(|e| format!("Failed to set MIME type: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-1")
        .text("language", language)
        .part("file", part);

    println!("Sending request to OpenAI Whisper API...");

    // Send request to OpenAI API
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to OpenAI: {}", e))?;

    // Check response status
    if !response.status().is_success() {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", error_text));
    }

    // Parse response
    let response_json: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    println!("Response received: {}", response_json);

    let text = response_json["text"]
        .as_str()
        .ok_or("Missing 'text' field in response")?
        .to_string();

    // Duration might not be in response with default format, estimate from file size
    // Rough estimate: ~1 minute per 1MB for typical audio formats
    let duration = response_json["duration"]
        .as_f64()
        .unwrap_or_else(|| {
            // Fallback: estimate duration from file size (very rough)
            let mb = file_size as f64 / 1_000_000.0;
            mb * 60.0 // Assume ~1MB per minute
        });

    println!("Transcription complete. Text length: {} chars, Duration: {}s", text.len(), duration);

    Ok(TranscribeResult { text, duration })
}

#[derive(Debug, Deserialize)]
struct PrescriptionData {
    client_name: String,
    pet_name: String,
    pet_species: String,
    pet_weight: String,
    medication_name: String,
    brand_names: String,
    formulation: String,
    dose_concentration: String,
    amount_to_dispense: String,
    dose_rate: String,
    frequency: String,
    repeats: String,
    special_instructions: String,
    prescription_date: String,
    schedule_class: String,
}

#[tauri::command]
fn generate_prescription_docx(
    template_content: String,
    output_path: String,
) -> Result<String, String> {
    use std::process::Stdio;

    // Get templates folder path
    let templates_path = match dirs::document_dir() {
        Some(docs_path) => {
            docs_path.join("PBS_Admin").join("Templates")
        },
        None => return Err("Could not find Documents folder".to_string()),
    };

    // Build letterhead file path (reference document for Pandoc)
    let letterhead_file_path = templates_path.join("Prescription_Template.docx");

    // Use the processed template content provided from frontend
    let markdown_content = template_content;

    // Build pandoc command with stdin input
    let mut cmd = Command::new("pandoc");
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Read from stdin
    cmd.arg("-");

    // Use hard_line_breaks extension to preserve all newlines
    cmd.arg("-f");
    cmd.arg("markdown+hard_line_breaks");

    // Add output file
    cmd.arg("-o");
    cmd.arg(&output_path);

    // Add reference document (letterhead) if it exists
    if letterhead_file_path.exists() {
        println!("Using prescription letterhead file: {:?}", letterhead_file_path);
        cmd.arg("--reference-doc");
        cmd.arg(letterhead_file_path.to_string_lossy().to_string());
    } else {
        let error_msg = format!("Prescription template file not found: {:?}. Please create Prescription_Template.docx in Documents\\PBS_Admin\\Templates\\", letterhead_file_path);
        println!("Warning: {}", error_msg);
        return Err(error_msg);
    }

    // Spawn process
    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn pandoc: {}. Is pandoc installed?", e))?;

    // Write markdown content to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(markdown_content.as_bytes())
            .map_err(|e| format!("Failed to write to pandoc stdin: {}", e))?;
    }

    // Wait for process to complete
    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for pandoc: {}", e))?;

    // Check if command succeeded
    if output.status.success() {
        Ok(output_path.clone())
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Pandoc conversion failed: {}", error_msg))
    }
}

// ============================================================================
// DATABASE BACKUP AND RESTORE
// ============================================================================

/// Get the path to the backups folder
#[tauri::command]
fn get_backups_path() -> Result<String, String> {
    let docs_dir = dirs::document_dir()
        .ok_or("Could not find Documents directory")?;
    let backups_path = docs_dir.join("PBS_Admin").join("Backups");

    // Create backups folder if it doesn't exist
    if !backups_path.exists() {
        std::fs::create_dir_all(&backups_path)
            .map_err(|e| format!("Failed to create backups folder: {}", e))?;
    }

    Ok(backups_path.to_string_lossy().to_string())
}


/// Create a backup of the database
#[tauri::command]
fn create_database_backup() -> Result<serde_json::Value, String> {
    let db_path = get_database_path_internal()?;
    let backups_path = get_backups_path()?;

    // Generate backup filename with timestamp
    let timestamp = chrono::Local::now().format("%Y-%m-%d-%H%M%S").to_string();
    let backup_filename = format!("pbs-admin-backup-{}.db", timestamp);
    let backup_path = std::path::Path::new(&backups_path).join(&backup_filename);

    // Copy the database file
    std::fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    println!("Backup created: {}", backup_path.display());

    Ok(serde_json::json!({
        "file_path": backup_path.to_string_lossy().to_string(),
        "file_name": backup_filename
    }))
}

/// Restore database from a backup file
#[tauri::command]
fn restore_database_backup(backup_path: String) -> Result<String, String> {
    let backup_file = std::path::Path::new(&backup_path);

    // Validate backup file exists
    if !backup_file.exists() {
        return Err(format!("Backup file not found: {}", backup_path));
    }

    // Validate it's a .db file
    if backup_file.extension().and_then(|e| e.to_str()) != Some("db") {
        return Err("Invalid backup file: must be a .db file".to_string());
    }

    let db_path = get_database_path_internal()?;

    // Create a safety backup before restoring (in case restore goes wrong)
    let safety_backup = db_path.with_extension("db.pre-restore-backup");
    std::fs::copy(&db_path, &safety_backup)
        .map_err(|e| format!("Failed to create safety backup: {}", e))?;

    // Restore the backup
    match std::fs::copy(&backup_file, &db_path) {
        Ok(_) => {
            // Remove safety backup on success
            let _ = std::fs::remove_file(&safety_backup);
            println!("Database restored from: {}", backup_path);
            Ok("Database restored successfully. Please restart the application.".to_string())
        }
        Err(e) => {
            // Try to restore from safety backup
            let _ = std::fs::copy(&safety_backup, &db_path);
            Err(format!("Failed to restore database: {}. Original database preserved.", e))
        }
    }
}

/// List available backup files
#[tauri::command]
fn list_database_backups() -> Result<Vec<serde_json::Value>, String> {
    let backups_path = get_backups_path()?;
    let backups_dir = std::path::Path::new(&backups_path);

    let mut backups = Vec::new();

    if let Ok(entries) = std::fs::read_dir(backups_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("db") {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with("pbs-admin-backup-") {
                        let metadata = std::fs::metadata(&path).ok();
                        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                        let created = metadata
                            .and_then(|m| m.created().ok())
                            .map(|t| {
                                let datetime: chrono::DateTime<chrono::Local> = t.into();
                                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                            })
                            .unwrap_or_default();

                        backups.push(serde_json::json!({
                            "fileName": file_name,
                            "filePath": path.to_string_lossy().to_string(),
                            "createdAt": created,
                            "sizeBytes": size
                        }));
                    }
                }
            }
        }
    }

    // Sort by filename (which includes timestamp) descending
    backups.sort_by(|a, b| {
        let name_a = a["fileName"].as_str().unwrap_or("");
        let name_b = b["fileName"].as_str().unwrap_or("");
        name_b.cmp(name_a)
    });

    Ok(backups)
}

/// Delete a backup file
#[tauri::command]
fn delete_backup_file(backup_path: String) -> Result<String, String> {
    let backup_file = std::path::Path::new(&backup_path);

    // Validate the file is in the backups folder (security check)
    let backups_path = get_backups_path()?;
    if !backup_path.starts_with(&backups_path) {
        return Err("Cannot delete files outside the backups folder".to_string());
    }

    // Validate it's a backup file
    if let Some(file_name) = backup_file.file_name().and_then(|n| n.to_str()) {
        if !file_name.starts_with("pbs-admin-backup-") {
            return Err("Cannot delete non-backup files".to_string());
        }
    }

    std::fs::remove_file(&backup_file)
        .map_err(|e| format!("Failed to delete backup: {}", e))?;

    Ok("Backup deleted successfully".to_string())
}

// ============================================================================
// EMAIL SENDING VIA RESEND API
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct EmailAttachment {
    filename: String,
    content: String, // Base64 encoded content
}

#[derive(Debug, Serialize)]
struct ResendEmailRequest {
    from: String,
    to: Vec<String>,
    subject: String,
    html: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    attachments: Option<Vec<ResendAttachment>>,
}

#[derive(Debug, Serialize)]
struct ResendAttachment {
    filename: String,
    content: String, // Base64 encoded
}

#[derive(Debug, Deserialize)]
struct ResendEmailResponse {
    id: String,
}

/// Send an email via Resend API with optional attachments
#[tauri::command]
async fn send_email(
    api_key: String,
    from: String,
    to: String,
    subject: String,
    html_body: String,
    attachment_paths: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    println!("Sending email to: {}", to);
    println!("Subject: {}", subject);

    // Process attachments if provided
    let attachments: Option<Vec<ResendAttachment>> = if let Some(paths) = attachment_paths {
        let mut att_list = Vec::new();
        for path in paths {
            let file_path = std::path::Path::new(&path);
            if !file_path.exists() {
                return Err(format!("Attachment file not found: {}", path));
            }

            // Read file and encode as base64
            let file_data = fs::read(&path)
                .map_err(|e| format!("Failed to read attachment {}: {}", path, e))?;

            let base64_content = base64_encode(&file_data);

            let filename = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("attachment")
                .to_string();

            println!("Attaching file: {} ({} bytes)", filename, file_data.len());

            att_list.push(ResendAttachment {
                filename,
                content: base64_content,
            });
        }
        Some(att_list)
    } else {
        None
    };

    // Build request body
    let email_request = ResendEmailRequest {
        from,
        to: vec![to.clone()],
        subject: subject.clone(),
        html: html_body,
        attachments,
    };

    // Send request to Resend API
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&email_request)
        .send()
        .await
        .map_err(|e| format!("Failed to send email request: {}", e))?;

    // Check response status
    let status = response.status();
    let response_text = response.text().await
        .unwrap_or_else(|_| "Unknown error".to_string());

    if !status.is_success() {
        return Err(format!("Resend API error ({}): {}", status, response_text));
    }

    // Parse response
    let response_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let email_id = response_json["id"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    println!("Email sent successfully! ID: {}", email_id);

    Ok(serde_json::json!({
        "success": true,
        "id": email_id,
        "to": to,
        "subject": subject
    }))
}

/// Simple base64 encoding function
fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut result = String::new();
    let mut i = 0;

    while i < data.len() {
        let b0 = data[i] as usize;
        let b1 = if i + 1 < data.len() { data[i + 1] as usize } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] as usize } else { 0 };

        result.push(ALPHABET[b0 >> 2] as char);
        result.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);

        if i + 1 < data.len() {
            result.push(ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            result.push('=');
        }

        if i + 2 < data.len() {
            result.push(ALPHABET[b2 & 0x3f] as char);
        } else {
            result.push('=');
        }

        i += 3;
    }

    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            create_folder,
            get_default_client_records_path,
            get_database_path,
            get_templates_path,
            read_text_file,
            write_text_file,
            write_binary_file,
            download_file,
            list_files,
            run_pandoc,
            run_pandoc_from_stdin,
            convert_docx_to_pdf,
            generate_prescription_docx,
            save_temp_audio_file,
            transcribe_audio,
            get_backups_path,
            create_database_backup,
            restore_database_backup,
            list_database_backups,
            delete_backup_file,
            send_email
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
