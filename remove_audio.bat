@echo off
SETLOCAL ENABLEDELAYEDEXPANSION


REM --- Script ---
REM Get the parent directory (base directory)
SET "BASE_DIR=%cd%"
ECHO Base directory: %BASE_DIR%

REM Create the reserve folder if it doesn't exist
IF NOT EXIST "%BASE_DIR%\reserve" (
    ECHO Creating reserve directory...
    mkdir "%BASE_DIR%\reserve"
)

ECHO Scanning for .mp4 files...

REM Loop through all .mp4 files in the base directory
FOR %%f IN ("%BASE_DIR%\*.mp4") DO (
    ECHO.
    ECHO Found file: "%%~nxf"

        REM --- Move original file to reserve folder ---
        ECHO  - Moving original to "%BASE_DIR%\reserve\"
        move "%%f" "%BASE_DIR%\reserve\"

        REM --- Compress video with ffmpeg ---
        ffmpeg -i "%BASE_DIR%\reserve\%%~nxf" -an -c:v copy "%BASE_DIR%\%%~nxf"
        
        REM --- New Error Handling ---
        IF !ERRORLEVEL! NEQ 0 (
            ECHO  - FFMPEG compression FAILED for "%%~nxf"! (Error Code: !ERRORLEVEL!^)
            ECHO  - Moving original file back to base directory.
            move "%BASE_DIR%\reserve\%%~nxf" "%BASE_DIR%\"
        ) ELSE (
            ECHO  - Compression finished successfully for "%%~nxf".
        )

)

ECHO.
ECHO Script finished.
PAUSE