/*
 * UAC lab marker — writes whoami /all to %TEMP%\\uac_lab_proof.txt
 * Compile (council / MSYS64):
 *   C:\\msys64\\mingw64\\bin\\gcc.exe uac_lab_marker.c -o uac_lab_marker.exe -O2 -s -static
 * Or: powershell -File ..\\..\\uac_msys64.ps1; Build-UacLabMarker -OutDir .
 * Elevated parent should launch this; validator checks proof file for High Mandatory Level.
 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    const char *cmd =
        "cmd /c whoami /all > %TEMP%\\uac_lab_proof.txt 2>&1";
    printf("[uac_lab_marker] invoking: %s\n", cmd);
    return system(cmd);
}
