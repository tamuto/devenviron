# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevEnviron is a development environment project that provides standardized development environments through Docker containers and VS Code devcontainers. The project focuses on creating consistent development setups across different platforms, with special emphasis on WSL2+Ubuntu environments.

## Key Commands

### Initial Setup
```bash
./setup.sh
```
Sets up the basic devcontainer structure and downloads necessary templates.

### Docker Image Building
```bash
./scripts/build_py3_11.sh <image-tag>
./scripts/build_py3_12.sh <image-tag>
./scripts/build_py3_13.sh <image-tag>
```
Build custom Docker images with different Python versions. Scripts customize Dockerfile content by replacing base images and architectures.

### Runtime Image Building
```bash
cd etc/runtimes
./build.sh <folder> <tag>
```
Build lightweight runtime images from the runtimes directory.

### Deployment
```bash
./deploy.sh <image-tag>
```
Deploy built images to Docker registry (requires appropriate permissions).

### Custom Host Commands
- `denvdb` / `denvdb8`: Start MySQL 8 container with preset configuration
- `denvtime`: Sync WSL time with host (fixes screen saver time drift issues)

### Container Commands
- `ssh-aws.sh <profile> <instance-name> [remote-command]`: SSH to AWS EC2 via SSM
- `ssh-fw-aws.sh <profile> <instance-name> <forward-port> [remote-command]`: SSH with port forwarding

## Architecture

### Core Structure
- `/template/`: Contains base devcontainer configuration and shell commands
- `/scripts/`: Docker build scripts for different environments (Python, PyTorch, ROS2, etc.)
- `/etc/runtimes/`: Lightweight runtime images (claudecode, nodetsx, pyuv, ros2_humble)
- `/docs/`: Documentation including setup guides and command references

### Container Configuration
The devcontainer setup uses:
- Base image: `tamuto/devenviron:0.38.0`
- Workspace mount: `/workspaces`
- Persistent mounts for: `.ssh`, `.aws`, `.gitconfig`, `.git-credentials`, `.npmrc`, `.config`
- Pre-configured VS Code settings with Python-focused development tools

### Build System
Build scripts in `/scripts/` use a template-replacement approach:
- Start with base Dockerfile templates
- Replace placeholders for base images, architectures, and versions
- Support for various targets: Python versions, L4T/Torch combinations, ROS2 environments

### Runtime Images
Lightweight images in `/etc/runtimes/` provide specialized environments:
- **claudecode**: Claude Code development environment
- **nodetsx**: Node.js with TypeScript execution
- **pyuv**: Python with UV package manager
- **ros2_humble**: ROS2 Humble robotics environment

The runtime system supports both standalone Docker execution and MCP server integration with WSL2.