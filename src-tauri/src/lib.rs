// PBS Admin - Tauri Application Entry Point

use std::fs;
use std::path::Path;
use std::io::Write;
use reqwest::blocking::get;

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
            read_text_file,
            write_text_file,
            write_binary_file,
            download_file,
            list_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
