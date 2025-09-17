@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

REM --- Configuration ---
REM Set a default target size first.
SET TARGET_SIZE_MB=10

REM Check if a parameter was provided. If so, validate it and overwrite the default.
IF NOT "%~1"=="" (
    SET "TARGET_SIZE_MB=%~1"
    
    REM --- VALIDATION BLOCK using DELAYED EXPANSION ---

    REM 1. Validate that the input is a valid integer.
    SET /A CHECK_VAR=!TARGET_SIZE_MB!
    
    IF "!CHECK_VAR!" NEQ "!TARGET_SIZE_MB!" (
        echo Error: Invalid characters in parameter. Please provide a valid number.
        goto :eof
    )

    REM 2. Validate that the number is positive (greater than 0).
    IF !TARGET_SIZE_MB! LEQ 0 (
        echo Error: Target size must be a positive number.
        goto :eof
    )
)
REM --- Script ---
REM Get the parent directory (base directory)
SET "BASE_DIR=%~dp0.."
ECHO Base directory: %BASE_DIR%

REM Create the reserve folder if it doesn't exist
IF NOT EXIST "%BASE_DIR%\reserve" (
    ECHO Creating reserve directory...
    mkdir "%BASE_DIR%\reserve"
)

REM Convert target size from MB to Bytes for file size comparison
SET /A TARGET_SIZE_BYTES = %TARGET_SIZE_MB% * 1024 * 1024

ECHO Target size: %TARGET_SIZE_MB% MB (%TARGET_SIZE_BYTES% Bytes)
ECHO Scanning for .mp4 files...

REM Loop through all .mp4 files in the base directory
FOR %%f IN ("%BASE_DIR%\*.mp4") DO (
    ECHO.
    ECHO Found file: "%%~nxf"
    
    REM Check if file size is greater than the target size
    IF %%~zf GTR %TARGET_SIZE_BYTES% (
        ECHO File size (%%~zf Bytes^) is larger than target. Processing...

        REM --- Get video duration using ffprobe ---
        ECHO  - Getting video duration...
        FOR /F "usebackq" %%d IN (`ffprobe -v error -show_entries format^=duration -of default^=noprint_wrappers^=1:nokey^=1 "%%f"`) DO (
            SET DURATION=%%d
        )
        ECHO  - Duration: !DURATION! seconds

        REM --- Calculate required bitrates using PowerShell ---
        ECHO  - Calculating bitrates...
        FOR /F "usebackq" %%b IN (`powershell -Command "[math]::Round(((%TARGET_SIZE_MB% * 1024 * 8) / !DURATION!) * 0.8)"`) DO (
            SET VIDEO_BITRATE=%%b
        )
        FOR /F "usebackq" %%a IN (`powershell -Command "[math]::Round(((%TARGET_SIZE_MB% * 1024 * 8) / !DURATION!) * 0.15)"`) DO (
            SET AUDIO_BITRATE=%%a
        )
        ECHO  - Target Video Bitrate: !VIDEO_BITRATE! kbps
        ECHO  - Target Audio Bitrate: !AUDIO_BITRATE! kbps

        REM --- Move original file to reserve folder ---
        ECHO  - Moving original to "%BASE_DIR%\reserve\"
        move "%%f" "%BASE_DIR%\reserve\"

        REM --- Compress video with ffmpeg ---
        ECHO  - Compressing...
        ffmpeg -i "%BASE_DIR%\reserve\%%~nxf" -b:v !VIDEO_BITRATE!k -b:a !AUDIO_BITRATE!k -y "%BASE_DIR%\%%~nxf"
        
        REM --- New Error Handling ---
        IF !ERRORLEVEL! NEQ 0 (
            ECHO  - FFMPEG compression FAILED for "%%~nxf"! (Error Code: !ERRORLEVEL!^)
            ECHO  - Moving original file back to base directory.
            move "%BASE_DIR%\reserve\%%~nxf" "%BASE_DIR%\"
        ) ELSE (
            ECHO  - Compression finished successfully for "%%~nxf".
        )

    ) ELSE (
        ECHO File size (%%~zf Bytes^) is within target size. Skipping.
    )
)

ECHO.
ECHO Script finished.
PAUSE