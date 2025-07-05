# Deprecation Archive - 2025-07-03

## Summary
This archive contains deprecated/redundant files and folders that were cluttering the main project directory.

## Archived Items

### Folders
- **aVOID-duplicate/** - Duplicate of VOIDaVOID folder
  - Contained similar structure but was redundant
  - Archived as: `folders/aVOID-duplicate/`

- **shared-with-me-random-files/** - Random files folder
  - Contained scattered configuration files and a zip file
  - Had duplicate package.json and config files
  - Archived as: `folders/shared-with-me-random-files/`

### Build Scripts
- **build-integrated.sh** - Legacy build script
- **setup-aVOIDgame-platform.ps1** - Old platform setup script  
- **setup-simple.ps1** - Simple setup script

### Configuration Files
- Multiple package.json files (in Shared With Me folder)
- Duplicate eslint.config.js, postcss.config.js, tailwind.config.js files
- Legacy TypeScript configuration files

## Reason for Archival
- **Redundancy**: Multiple folders contained similar/duplicate files
- **Organization**: Scattered configuration files needed consolidation
- **Maintenance**: Legacy build scripts were no longer needed
- **Clarity**: Main directory was cluttered with deprecated items

## Active Project Structure
The main project now uses:
- **VOIDaVOID/** as the primary codebase
- Root-level package.json for main configuration
- Consolidated build scripts in appropriate directories

## Recovery
If any archived files are needed, they can be restored from this archive directory.
