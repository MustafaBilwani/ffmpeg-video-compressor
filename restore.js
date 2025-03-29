import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

/**
 * Checks if a file is a valid MP4 file using ffprobe
 * @param {string} filePath - Path to the file to check
 * @returns {Promise<boolean>} - Promise resolving to true if file is valid, false otherwise
 */
function isValidMp4(filePath) {
  return new Promise((resolve) => {
    // Using ffprobe to check if the MP4 file is valid
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'json',
      filePath
    ]);
    
    let output = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        // ffprobe returned with error
        resolve(false);
        return;
      }
      
      try {
        const result = JSON.parse(output);
        // Check if we have valid video stream data
        const isValid = result && 
                       result.streams && 
                       result.streams.length > 0 && 
                       result.streams[0].codec_type === 'video';
        
        resolve(isValid);
      } catch (e) {
        console.log(`Error parsing ffprobe output: ${e.message}`);
        resolve(false);
      }
    });
    
    ffprobe.on('error', () => {
      console.log(`Failed to run ffprobe on ${path.basename(filePath)}`);
      resolve(false);
    });
  });
}

/**
 * Moves all files from sourceDir to targetDir, replacing invalid MP4 files in targetDir
 * @param {string} sourceDir - Directory containing files to move
 * @param {string} targetDir - Directory where files should be moved to
 */
async function moveFiles(sourceDir, targetDir) {
  // Ensure the paths are absolute
  const absoluteSourceDir = path.resolve(sourceDir);
  const absoluteTargetDir = path.resolve(targetDir);
  
  console.log(`Moving all files from ${absoluteSourceDir} to ${absoluteTargetDir}`);
  
  try {
    // Ensure target directory exists
    if (!fs.existsSync(absoluteTargetDir)) {
      console.log(`Creating target directory: ${absoluteTargetDir}`);
      fs.mkdirSync(absoluteTargetDir, { recursive: true });
    }
    
    // Read all items in the source directory
    const items = fs.readdirSync(absoluteSourceDir);
    
    // Process each item
    for (const item of items) {
      const sourcePath = path.join(absoluteSourceDir, item);
      const destPath = path.join(absoluteTargetDir, item);
      
      // Check if it's a file
      const stats = fs.statSync(sourcePath);
      if (stats.isFile()) {
        // First check if source file is a valid MP4
        const isSourceValid = await isValidMp4(sourcePath);
        if (!isSourceValid) {
          console.log(`Skipping invalid source file: ${item}`);
          continue;
        }
        
        // Check if a file with the same name already exists in the target directory
        if (fs.existsSync(destPath)) {
          // Check if the existing file is a valid MP4
          const isDestValid = await isValidMp4(destPath);
          
          if (!isDestValid) {
            // Replace the invalid MP4 file
            fs.renameSync(sourcePath, destPath);
            console.log(`Replaced invalid MP4 file: ${item}`);
          } else {
            console.log(`Skipping ${item}: Valid MP4 already exists in target directory`);
          }
          continue;
        }
        
        // Move the file (no existing file found)
        fs.renameSync(sourcePath, destPath);
        console.log(`Moved: ${item}.`);
      } else {
        console.log(`Skipping directory: ${item}`);
      }
    }
    
    console.log('Operation completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Set source and target directories using import.meta.dirname
// import.meta.dirname gives us the directory where the script file is located
const scriptDir = import.meta.dirname;
const parentDir = path.join(scriptDir, '..');
const reserveDir = path.join(parentDir, 'reserve');

console.log('Script directory:', scriptDir);
console.log('Parent directory (incomplete):', parentDir);
console.log('Reserve directory:', reserveDir);

// Move files from reserve to incomplete (parent directory)
moveFiles(reserveDir, parentDir);