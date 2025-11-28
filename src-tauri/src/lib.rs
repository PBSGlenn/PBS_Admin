// PBS Admin - Tauri Application Entry Point

use std::fs;
use std::path::Path;
use std::io::Write;
use std::process::Command;
use reqwest::blocking::get;
use serde::{Deserialize, Serialize};

#[tauri::command]
fn create_folder(path: String) -> Result<String, String> {
    let folder_path = Path::new(&path);

    // Check if folder already exists
    if folder_path.exists() {
        return Err(format!("Folder already exists: {}", path));
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
    let path = Path::new(&file_path);

    // Check if file exists
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    // Read file content
    match fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Write content to file
    match fs::File::create(path) {
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
    let path = Path::new(&file_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Write binary data to file
    match fs::File::create(path) {
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
    let path = Path::new(&file_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
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
    match fs::File::create(path) {
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
    let dir_path = Path::new(&directory);

    // Check if directory exists
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", directory));
    }

    // Read directory entries
    let entries = fs::read_dir(dir_path)
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

    // Add output file
    cmd.arg("-o");
    cmd.arg(&output_path);

    // Add reference document (template) if provided
    if let Some(template) = template_path {
        cmd.arg("--reference-doc");
        cmd.arg(&template);
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

    // Add output file
    cmd.arg("-o");
    cmd.arg(&output_path);

    // Add reference document (template) if provided
    if let Some(template) = template_path {
        cmd.arg("--reference-doc");
        cmd.arg(&template);
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
    let ps_script = format!(
        r#"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {{
    $doc = $word.Documents.Open("{}")
    $doc.SaveAs("{}", 17)
    $doc.Close()
    Write-Output "Success"
}} catch {{
    Write-Error $_.Exception.Message
    exit 1
}} finally {{
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
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
        Err(format!("PDF conversion failed: {}", error_msg))
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
            get_templates_path,
            read_text_file,
            write_text_file,
            write_binary_file,
            download_file,
            list_files,
            run_pandoc,
            run_pandoc_from_stdin,
            convert_docx_to_pdf,
            save_temp_audio_file,
            transcribe_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
