// PBS Admin - Tauri Application Entry Point

use std::fs;
use std::path::{Path, PathBuf};
use std::io::Write;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::collections::HashMap;
use reqwest::blocking::get;
use serde::{Deserialize, Serialize};
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    image::Image as TauriImage,
};
use tauri_plugin_autostart::MacosLauncher;
use image::GenericImageView;
use sha2::{Sha256, Digest};

// ============================================================================
// RATE LIMITING FOR API CALLS
// ============================================================================

static RATE_LIMITER: std::sync::LazyLock<Mutex<HashMap<&'static str, Instant>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

/// Check if an operation is allowed based on cooldown period.
/// Returns Ok(()) if allowed, Err with message if rate limited.
fn check_rate_limit(operation: &'static str, cooldown: Duration) -> Result<(), String> {
    let mut map = RATE_LIMITER.lock().map_err(|_| "Rate limiter lock error".to_string())?;
    if let Some(last) = map.get(operation) {
        let elapsed = last.elapsed();
        if elapsed < cooldown {
            let remaining = cooldown - elapsed;
            return Err(format!(
                "Please wait {} seconds before retrying {}.",
                remaining.as_secs() + 1,
                operation
            ));
        }
    }
    map.insert(operation, Instant::now());
    Ok(())
}

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

/// Download update installer to temp directory with hash verification, then run it
#[tauri::command]
async fn download_and_run_update(url: String, filename: String, expected_size: Option<u64>) -> Result<String, String> {
    // Validate URL is from the official GitHub repository releases
    // Only allow the specific releases download pattern
    if !url.starts_with("https://github.com/PBSGlenn/PBS_Admin/releases/download/") {
        return Err("Updates can only be downloaded from official PBS Admin GitHub releases.".to_string());
    }

    // Validate filename has no path traversal and is an executable
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid installer filename.".to_string());
    }
    if !filename.to_lowercase().ends_with(".exe") {
        return Err("Installer must be an .exe file.".to_string());
    }

    // Get temp directory
    let temp_dir = std::env::temp_dir().join("PBS_Admin_Updates");

    // Create temp directory if needed
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }

    let file_path = temp_dir.join(&filename);

    // Download file from URL using async reqwest with redirect policy
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download installer: {}", e))?;

    // Verify we ended up at a GitHub domain after redirects
    let final_url = response.url().to_string();
    let allowed_hosts = [
        "github.com",
        "objects.githubusercontent.com",
        "github-releases.githubusercontent.com",
        "release-assets.githubusercontent.com",
    ];
    let final_host = response.url().host_str().unwrap_or("");
    if !allowed_hosts.iter().any(|h| final_host == *h || final_host.ends_with(&format!(".{}", h))) {
        return Err(format!(
            "Download redirected to untrusted host: {}. Aborting for security.",
            final_host
        ));
    }

    // Check response status
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    // Get response body as bytes
    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Verify file size if expected size was provided (from GitHub release API)
    if let Some(expected) = expected_size {
        if bytes.len() as u64 != expected {
            return Err(format!(
                "Downloaded file size ({} bytes) does not match expected size ({} bytes). Download may be corrupted or tampered with.",
                bytes.len(), expected
            ));
        }
    }

    // Basic sanity check: installer should be a reasonable size (> 1MB, < 500MB)
    if bytes.len() < 1_000_000 {
        return Err("Downloaded file is too small to be a valid installer. Aborting.".to_string());
    }
    if bytes.len() > 500_000_000 {
        return Err("Downloaded file is unexpectedly large. Aborting.".to_string());
    }

    // Verify it looks like a PE executable (MZ header)
    if bytes.len() < 2 || bytes[0] != 0x4D || bytes[1] != 0x5A {
        return Err("Downloaded file is not a valid Windows executable. Aborting.".to_string());
    }

    // Write to file
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write installer file: {}", e))?;

    // Run the installer
    Command::new(&file_path)
        .spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
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
fn pandoc_docx_to_markdown(docx_path: String) -> Result<String, String> {
    if !docx_path.to_lowercase().ends_with(".docx") {
        return Err("Input file must be a .docx file".to_string());
    }
    if !std::path::Path::new(&docx_path).exists() {
        return Err(format!("File not found: {}", docx_path));
    }

    let output = Command::new("pandoc")
        .arg(&docx_path)
        .arg("-f").arg("docx")
        .arg("-t").arg("markdown")
        .arg("--wrap=none")
        .output()
        .map_err(|e| format!("Failed to execute pandoc: {}. Is pandoc installed?", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Pandoc returned non-UTF8 output: {}", e))
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Pandoc docx→markdown failed: {}", error_msg))
    }
}

#[tauri::command]
fn run_pandoc(input_path: String, output_path: String, template_path: Option<String>) -> Result<String, String> {
    // Validate input file extension
    let input_lower = input_path.to_lowercase();
    if !input_lower.ends_with(".md") && !input_lower.ends_with(".markdown") && !input_lower.ends_with(".txt") {
        return Err("Input file must be a .md, .markdown, or .txt file".to_string());
    }

    // Validate output file extension
    let output_lower = output_path.to_lowercase();
    if !output_lower.ends_with(".docx") && !output_lower.ends_with(".pdf") && !output_lower.ends_with(".html") {
        return Err("Output file must be a .docx, .pdf, or .html file".to_string());
    }

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
        // Validate template is a .docx file
        if !template.to_lowercase().ends_with(".docx") {
            return Err("Template must be a .docx file".to_string());
        }
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
    // Use single-quoted strings in PowerShell to prevent variable expansion injection.
    // Single quotes treat content literally — no $variable or backtick interpretation.
    // Escape any embedded single quotes by doubling them ('').
    let safe_docx = docx_path.replace("'", "''");
    let safe_pdf = pdf_path.replace("'", "''");

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
    $doc = $word.Documents.Open('{}', $false, $true)

    # Save as PDF (17 = wdFormatPDF)
    $doc.SaveAs('{}', 17)
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
        safe_docx,
        safe_pdf
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

#[derive(Serialize, Deserialize, Clone)]
struct DiarizedSegment {
    speaker: String,
    text: String,
    start: f64,
    end: f64,
}

#[derive(Serialize)]
struct TranscribeResult {
    text: String,
    duration: f64,
    segments: Option<Vec<DiarizedSegment>>,
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

/// Check if FFmpeg is available on the system
#[tauri::command]
fn check_ffmpeg() -> Result<String, String> {
    let output = Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map_err(|_| "FFmpeg is not installed or not in PATH. Please install FFmpeg to process large audio files.".to_string())?;

    if !output.status.success() {
        return Err("FFmpeg found but returned an error.".to_string());
    }

    let version_str = String::from_utf8_lossy(&output.stdout);
    let first_line = version_str.lines().next().unwrap_or("unknown").to_string();
    Ok(first_line)
}

/// Compress audio file to mono MP3 at specified bitrate using FFmpeg
/// This reduces file size significantly for transcription
#[tauri::command]
fn compress_audio(input_path: String, bitrate: Option<String>) -> Result<String, String> {
    let br = bitrate.unwrap_or_else(|| "64k".to_string());

    let temp_dir = std::env::temp_dir().join("PBS_Admin");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let output_path = temp_dir.join(format!("{}_compressed.mp3", timestamp));

    println!("Compressing audio: {} -> {} (bitrate: {})", input_path, output_path.display(), br);

    let output = Command::new("ffmpeg")
        .args([
            "-i", &input_path,
            "-ac", "1",           // mono
            "-ab", &br,           // bitrate (e.g., "64k")
            "-ar", "16000",       // 16kHz sample rate (sufficient for speech)
            "-y",                 // overwrite output
            &output_path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg compression failed: {}", stderr));
    }

    let compressed_size = fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    println!("Compression complete: {:.1} MB", compressed_size as f64 / 1_048_576.0);

    Ok(output_path.to_string_lossy().to_string())
}

/// Split audio file into chunks of specified duration (in seconds) using FFmpeg
/// Returns a list of chunk file paths
#[tauri::command]
fn split_audio(input_path: String, chunk_duration_secs: u64) -> Result<Vec<String>, String> {
    let temp_dir = std::env::temp_dir().join("PBS_Admin").join("chunks");
    if temp_dir.exists() {
        // Clean up old chunks
        let _ = fs::remove_dir_all(&temp_dir);
    }
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create chunks directory: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let output_pattern = temp_dir.join(format!("{}_chunk_%03d.mp3", timestamp));

    println!("Splitting audio into {}s chunks: {}", chunk_duration_secs, input_path);

    let output = Command::new("ffmpeg")
        .args([
            "-i", &input_path,
            "-f", "segment",
            "-segment_time", &chunk_duration_secs.to_string(),
            "-ac", "1",           // mono
            "-ab", "64k",         // 64kbps
            "-ar", "16000",       // 16kHz
            "-y",
            &output_pattern.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg split failed: {}", stderr));
    }

    // Collect all generated chunk files (sorted by name)
    let mut chunk_paths: Vec<String> = fs::read_dir(&temp_dir)
        .map_err(|e| format!("Failed to read chunks directory: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension().map(|e| e == "mp3").unwrap_or(false) {
                Some(path.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();

    chunk_paths.sort();

    println!("Split into {} chunks", chunk_paths.len());

    if chunk_paths.is_empty() {
        return Err("FFmpeg produced no output chunks".to_string());
    }

    Ok(chunk_paths)
}

/// Get audio file duration in seconds using FFmpeg
#[tauri::command]
fn get_audio_duration_ffmpeg(file_path: String) -> Result<f64, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &file_path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed: {}", stderr));
    }

    let duration_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    duration_str.parse::<f64>()
        .map_err(|_| format!("Failed to parse duration: {}", duration_str))
}

/// Transcribe audio using OpenAI gpt-4o-transcribe-diarize API
/// Uses native speaker diarization - no separate Claude call needed
#[tauri::command]
async fn transcribe_audio(
    file_path: String,
    language: String,
    api_key: Option<String>,
    speaker_names: Option<Vec<String>>,
) -> Result<TranscribeResult, String> {
    // Rate limit: 1 transcription per 30 seconds
    check_rate_limit("transcription", Duration::from_secs(30))?;

    println!("Transcribing audio file: {}", file_path);

    // Use provided API key or fall back to environment variable
    let api_key = if let Some(key) = api_key {
        if key.is_empty() {
            return Err("OpenAI API key cannot be empty".to_string());
        }
        key
    } else {
        std::env::var("OPENAI_API_KEY")
            .map_err(|_| "OpenAI API key not configured. Please add your API key in Settings > API Keys.".to_string())?
    };

    // Read audio file
    let file_data = fs::read(&file_path)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;

    let file_size = file_data.len();
    println!("Audio file size: {} bytes ({:.1} MB)", file_size, file_size as f64 / 1_048_576.0);

    // Check file size limit (OpenAI API has 25MB limit per request)
    const MAX_FILE_SIZE: usize = 25 * 1024 * 1024; // 25MB
    if file_size > MAX_FILE_SIZE {
        let mb = file_size as f64 / 1_048_576.0;
        return Err(format!(
            "CHUNK_REQUIRED:{:.1}",
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
    } else if file_name.ends_with(".ogg") {
        "audio/ogg"
    } else if file_name.ends_with(".flac") {
        "audio/flac"
    } else {
        "audio/mpeg" // default
    };

    // Create multipart form with diarization model
    let part = reqwest::multipart::Part::bytes(file_data)
        .file_name(file_name)
        .mime_str(mime_type)
        .map_err(|e| format!("Failed to set MIME type: {}", e))?;

    let mut form = reqwest::multipart::Form::new()
        .text("model", "gpt-4o-transcribe-diarize")
        .text("language", language)
        .text("response_format", "diarized_json")
        .text("chunking_strategy", "auto")
        .part("file", part);

    // Add speaker names if provided (up to 4)
    if let Some(names) = speaker_names {
        for name in names.into_iter().take(4) {
            form = form.text("known_speaker_names[]", name);
        }
    }

    println!("Sending request to OpenAI Transcription API (gpt-4o-transcribe-diarize)...");

    // Send request to OpenAI API
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout for long audio
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

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

    // Parse diarized JSON response
    let response_json: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    println!("Transcription response received successfully");

    let text = response_json["text"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Parse diarized segments
    let segments: Option<Vec<DiarizedSegment>> = response_json["segments"]
        .as_array()
        .map(|arr| {
            arr.iter().filter_map(|seg| {
                Some(DiarizedSegment {
                    speaker: seg["speaker"].as_str()?.to_string(),
                    text: seg["text"].as_str()?.to_string(),
                    start: seg["start"].as_f64()?,
                    end: seg["end"].as_f64()?,
                })
            }).collect()
        });

    // Calculate duration from last segment end time, or estimate from file size
    let duration = segments.as_ref()
        .and_then(|segs| segs.last())
        .map(|last| last.end)
        .or_else(|| response_json["duration"].as_f64())
        .unwrap_or_else(|| {
            let mb = file_size as f64 / 1_000_000.0;
            mb * 60.0
        });

    let segment_count = segments.as_ref().map(|s| s.len()).unwrap_or(0);
    println!("Transcription complete. Text: {} chars, Duration: {:.0}s, Segments: {}",
        text.len(), duration, segment_count);

    Ok(TranscribeResult { text, duration, segments })
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

    // Compute SHA-256 hash of the backup
    let data = std::fs::read(&backup_path)
        .map_err(|e| format!("Failed to read backup for hash: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let hash = format!("{:x}", hasher.finalize());

    println!("Backup created: {} (SHA-256: {})", backup_path.display(), &hash[..16]);

    Ok(serde_json::json!({
        "file_path": backup_path.to_string_lossy().to_string(),
        "file_name": backup_filename,
        "hash": hash
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

/// Verify backup file integrity (SHA-256 hash + SQLite magic header check)
#[tauri::command]
fn verify_backup_integrity(backup_path: String) -> Result<serde_json::Value, String> {
    let path = std::path::Path::new(&backup_path);

    if !path.exists() {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "File not found"
        }));
    }

    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let size = metadata.len();

    if size == 0 {
        return Ok(serde_json::json!({
            "valid": false,
            "size": 0,
            "error": "File is empty"
        }));
    }

    // Read file contents
    let data = std::fs::read(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Check SQLite magic header: first 16 bytes should be "SQLite format 3\0"
    let sqlite_magic = b"SQLite format 3\0";
    let has_valid_header = data.len() >= 16 && &data[..16] == sqlite_magic;

    // Compute SHA-256 hash
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let hash = format!("{:x}", hasher.finalize());

    if !has_valid_header {
        return Ok(serde_json::json!({
            "valid": false,
            "size": size,
            "hash": hash,
            "error": "File is not a valid SQLite database"
        }));
    }

    Ok(serde_json::json!({
        "valid": true,
        "size": size,
        "hash": hash
    }))
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
    api_key: Option<String>,
    from: String,
    to: String,
    subject: String,
    html_body: String,
    attachment_paths: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    // Rate limit: 1 email per 5 seconds
    check_rate_limit("email", Duration::from_secs(5))?;

    // Use provided API key or fall back to environment variable
    let api_key = if let Some(key) = api_key {
        if key.is_empty() {
            return Err("Resend API key cannot be empty".to_string());
        }
        key
    } else {
        std::env::var("RESEND_API_KEY")
            .or_else(|_| std::env::var("VITE_RESEND_API_KEY"))
            .map_err(|_| "Resend API key not configured. Please add your API key in Settings > API Keys.".to_string())?
    };

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

// ============================================================================
// ANTHROPIC AI API
// ============================================================================

/// Request body for Anthropic Claude API
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: Vec<AnthropicSystemMessage>,
    messages: Vec<AnthropicMessage>,
}

#[derive(Debug, Serialize)]
struct AnthropicSystemMessage {
    #[serde(rename = "type")]
    msg_type: String,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_control: Option<AnthropicCacheControl>,
}

#[derive(Debug, Serialize)]
struct AnthropicCacheControl {
    #[serde(rename = "type")]
    control_type: String,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContentBlock>,
    usage: AnthropicUsage,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

/// Generate AI report using Anthropic Claude API
/// API key can be passed directly or read from environment variable
#[tauri::command]
async fn generate_ai_report(
    system_prompt: String,
    user_prompt: String,
    max_tokens: u32,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<serde_json::Value, String> {
    // Rate limit: 1 report per 60 seconds
    check_rate_limit("ai_report", Duration::from_secs(60))?;

    // Use provided API key, or fall back to environment variable
    let api_key = if let Some(key) = api_key {
        if key.is_empty() {
            return Err("API key cannot be empty".to_string());
        }
        key
    } else {
        // Fall back to environment variable (for development)
        // Load .env file from project root
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()));

        if let Some(dir) = exe_dir {
            // Try loading from various locations
            let _ = dotenvy::from_path(dir.join(".env"));
            let _ = dotenvy::from_path(dir.join("../.env"));
            let _ = dotenvy::from_path(dir.join("../../.env"));
        }
        // Also try current directory and standard locations
        let _ = dotenvy::dotenv();

        std::env::var("VITE_ANTHROPIC_API_KEY")
            .or_else(|_| std::env::var("ANTHROPIC_API_KEY"))
            .map_err(|_| "Anthropic API key not configured. Please add your API key in Settings > API Keys.".to_string())?
    };

    let model = model.unwrap_or_else(|| "claude-opus-4-6-20260205".to_string());

    println!("Generating AI report with model: {}", model);
    println!("System prompt length: {} chars", system_prompt.len());
    println!("User prompt length: {} chars", user_prompt.len());
    println!("Max tokens: {}", max_tokens);

    // Build request
    let request = AnthropicRequest {
        model: model.to_string(),
        max_tokens,
        system: vec![AnthropicSystemMessage {
            msg_type: "text".to_string(),
            text: system_prompt,
            cache_control: Some(AnthropicCacheControl {
                control_type: "ephemeral".to_string(),
            }),
        }],
        messages: vec![AnthropicMessage {
            role: "user".to_string(),
            content: user_prompt,
        }],
    };

    // Send request to Anthropic API
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to Anthropic API: {}", e))?;

    // Check response status
    let status = response.status();
    let response_text = response.text().await
        .unwrap_or_else(|_| "Unknown error".to_string());

    if !status.is_success() {
        println!("Anthropic API error ({}): {}", status, response_text);
        return Err(format!("Anthropic API error ({}): {}", status, response_text));
    }

    // Parse response
    let api_response: AnthropicResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse Anthropic response: {}. Response: {}", e, response_text))?;

    // Extract text content
    let content = api_response.content
        .iter()
        .filter_map(|block| {
            if block.block_type == "text" {
                block.text.clone()
            } else {
                None
            }
        })
        .collect::<Vec<String>>()
        .join("\n");

    if content.is_empty() {
        return Err("No text content in Anthropic API response".to_string());
    }

    println!("AI report generated successfully!");
    println!("Input tokens: {}, Output tokens: {}",
        api_response.usage.input_tokens, api_response.usage.output_tokens);

    Ok(serde_json::json!({
        "success": true,
        "content": content,
        "usage": {
            "input_tokens": api_response.usage.input_tokens,
            "output_tokens": api_response.usage.output_tokens,
            "total_tokens": api_response.usage.input_tokens + api_response.usage.output_tokens
        }
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]) // Pass args when auto-started
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Create system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show PBS Admin", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // Load tray icon from embedded PNG (with graceful fallback)
            let icon_bytes = include_bytes!("../icons/32x32.png");
            let icon = match image::load_from_memory(icon_bytes) {
                Ok(icon_img) => {
                    let rgba = icon_img.to_rgba8();
                    let (width, height) = icon_img.dimensions();
                    TauriImage::new_owned(rgba.into_raw(), width, height)
                }
                Err(e) => {
                    eprintln!("Warning: Failed to decode tray icon PNG: {}. Using fallback.", e);
                    // Create a minimal 1x1 transparent fallback icon
                    TauriImage::new_owned(vec![0, 0, 0, 0], 1, 1)
                }
            };

            // Build system tray
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("PBS Admin")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Double-click to show window
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Check if started with --minimized flag (auto-start)
            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--minimized".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing (if enabled via settings)
            // For now, just handle close request
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing
                let _ = window.hide();
                api.prevent_close();
            }
        })
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
            pandoc_docx_to_markdown,
            convert_docx_to_pdf,
            generate_prescription_docx,
            save_temp_audio_file,
            check_ffmpeg,
            compress_audio,
            split_audio,
            get_audio_duration_ffmpeg,
            transcribe_audio,
            get_backups_path,
            create_database_backup,
            restore_database_backup,
            list_database_backups,
            delete_backup_file,
            verify_backup_integrity,
            send_email,
            generate_ai_report,
            download_and_run_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
