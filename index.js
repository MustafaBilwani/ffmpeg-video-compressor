import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg'

// Define paths relative to the script location
const scriptDir = import.meta.dirname;
const parentDir = path.join(scriptDir, '..');
const reserveFolder = path.join(parentDir, 'reserve');

const requiredSize = 10 * 1024 * 8 // in kilobits

const videos = fs.readdirSync(parentDir).map(fileName => (
  path.join(parentDir, fileName)
)).filter(filePath => (
  filePath.endsWith('.mp4') && fs.statSync(filePath).size > 10 * 1024 * 1024
))

if (videos.length === 0) {
  console.log("No valid video files found.");
  process.exit(1);
}

console.log(videos.length, 'videos found')
let videosSuccessfulCount = 0
let videosFailedCount = 0
let largeSizeCount = 0
printSummary()

// Create reserve directory if it doesn't exist
if (!fs.existsSync(reserveFolder)) {
  fs.mkdirSync(reserveFolder, { recursive: true });
}

videos.forEach((videoOrignalPath, index) => {

  const videoBaseName = path.basename(videoOrignalPath)
  const videoReservePath = path.join(parentDir, 'reserve', videoBaseName)

  try {

    fs.renameSync(videoOrignalPath, videoReservePath)
    // console.log(`Video ${index + 1} backup successful`);

    ffmpeg.ffprobe(videoReservePath, (err, metaData) => {
      if (err) {
        console.error(`ffprobe error in video ${index + 1}:`, err);
        videosFailedCount++;
        printSummary()
        console.log(`${videosFailedCount} videos failed`);
        restoreBackup({ videoOrignalPath, videoReservePath });
      } else {

        const durationSeconds = metaData.format.duration;
        // console.log('Duration:', durationSeconds);
        // console.log('Size:', Math.round(metaData.format.size / 1024 / 1024), 'MB');
        const requiredVideoBitrate = requiredSize / durationSeconds * 0.8 // in kbps
        const requiredAudioBitrate = requiredSize / durationSeconds * 0.15 // in kbps
        

        ffmpeg(videoReservePath)
          .videoCodec('libx264')
          .videoBitrate(requiredVideoBitrate)
          .audioCodec('aac')
          .audioBitrate(requiredAudioBitrate)
          .saveToFile(videoOrignalPath)
          .on('progress', (progress) => {
            // if (progress.percent) {
            //   process.stdout.clearLine();
            //   process.stdout.cursorTo(0);
            //   process.stdout.write(`Processing: ${Math.floor(progress.percent)}% done`);
            // }
          })
          .on('end', () => {
            // process.stdout.clearLine();
            // process.stdout.cursorTo(0);

            const outputStats = fs.statSync(videoOrignalPath);
            
            if (outputStats.size <= 10 * 1024 * 1024) {
              videosSuccessfulCount++;
              printSummary()
              // console.log(`Compression complete. Final size: ${Math.round(outputStats.size / 1024 / 1024)}MB`);
            } else {
              largeSizeCount++;
              printSummary()
              // console.log(`Warning: Compressed file (${Math.round(outputStats.size / 1024 / 1024)}MB) still exceeds target size`);
            }
          })
          .on('error', (err) => {
            console.error("FFmpeg compression error:", err);
            videosFailedCount++;
            printSummary()
            restoreBackup({ videoOrignalPath, videoReservePath })
          });
        }
      })

  } catch (error) {  
    console.log('error', error)
    videosFailedCount++;
    printSummary()
    restoreBackup({ videoOrignalPath, videoReservePath })  
  }
})

function printSummary() {
  const videosCompleteTotal = videosSuccessfulCount + videosFailedCount + largeSizeCount
  if (videosSuccessfulCount + videosFailedCount + largeSizeCount === videos.length) {
    console.log('Completed')
    console.log(`${videosSuccessfulCount} videos compressed successfully`);
    console.log(`${videosFailedCount} videos failed`);
    console.log(`${largeSizeCount} videos still exceeds target size`);
  } else {
    console.log(`Compressing... ${videosCompleteTotal}/${videos.length} Completed.`)
  }
}

function restoreBackup ({ videoOrignalPath, videoReservePath }) {
  // If anything went wrong, we can restore from backup

  if (fs.existsSync(videoReservePath)) {
    console.log("Restoring original file from backup...");
    if (fs.existsSync(videoOrignalPath)) {
      fs.unlinkSync(videoOrignalPath);
    }
    fs.renameSync(videoReservePath, videoOrignalPath);
    console.log("Restoration complete.");
  }
}

/*
  .size('640x480').size('640x?').size('?x480').size('50%')
  pipe
*/