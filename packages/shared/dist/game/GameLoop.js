export class GameLoop {
    animationFrame = null;
    lastTime = 0;
    gameTime = 0;
    started = false;
    gracePeriodActive = false;
    gracePeriodDuration = 3000; // 3 seconds
    gracePeriodStartTime = 0;
    isPaused = false;
    pausedTime = 0;
    lastPauseTime = 0;
    // FPS tracking
    frameCount = 0;
    fpsLastTime = 0;
    currentFPS = 0;
    fpsUpdateInterval = 500;
    // Performance mode tracking
    performanceModeActive = false;
    autoPerformanceModeEnabled = false;
    lowFPSStartTime = 0;
    lowFPSThreshold = 45;
    lowFPSDuration = 3000; // 3 seconds
    // Performance tracking
    frameTimes = [];
    averageFrameTime = 0;
    memoryUsageEstimate = 0;
    lastScalingEvent = 'none';
    scalingEventTime = 0;
    // Callbacks
    updateCallback;
    renderCallback;
    onStateUpdateCallback;
    applyPerformanceModeCallback;
    constructor(updateCallback, renderCallback, onStateUpdateCallback, applyPerformanceModeCallback) {
        this.updateCallback = updateCallback;
        this.renderCallback = renderCallback;
        this.onStateUpdateCallback = onStateUpdateCallback;
        this.applyPerformanceModeCallback = applyPerformanceModeCallback;
        // Add focus/blur event listeners for auto-pause
        window.addEventListener('blur', this.handleWindowBlur);
        window.addEventListener('focus', this.handleWindowFocus);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    handleWindowBlur = () => {
        if (this.started && !this.isPaused) {
            this.pauseGame();
        }
    };
    handleWindowFocus = () => {
        // Let the user manually resume if they want
    };
    handleVisibilityChange = () => {
        if (document.hidden && this.started && !this.isPaused) {
            this.pauseGame();
        }
    };
    pauseGame() {
        if (this.isPaused || !this.started)
            return;
        this.isPaused = true;
        this.lastPauseTime = performance.now();
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    resumeGame() {
        if (!this.isPaused || !this.started)
            return;
        this.isPaused = false;
        // Account for paused time
        const pauseDuration = performance.now() - this.lastPauseTime;
        this.pausedTime += pauseDuration;
        // Adjust grace period if active
        if (this.gracePeriodActive) {
            this.gracePeriodStartTime += pauseDuration;
        }
        // Restart game loop
        this.animationFrame = requestAnimationFrame(this.gameLoop);
    }
    applyPerformanceMode(enabled) {
        this.performanceModeActive = enabled;
        this.applyPerformanceModeCallback(enabled);
        if (enabled) {
            this.lastScalingEvent = 'Performance mode enabled';
        }
        else {
            this.lastScalingEvent = 'Performance mode disabled';
        }
        this.scalingEventTime = Date.now();
    }
    updateFPS(timestamp) {
        this.frameCount++;
        // Calculate frame time for performance tracking
        if (this.lastTime > 0) {
            const frameTime = timestamp - this.lastTime;
            this.frameTimes.push(frameTime);
            // Keep only last 60 frames for rolling average
            if (this.frameTimes.length > 60) {
                this.frameTimes.shift();
            }
            // Calculate average frame time
            this.averageFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
        }
        // Update FPS every 500ms
        if (timestamp - this.fpsLastTime >= this.fpsUpdateInterval) {
            const timeDiff = timestamp - this.fpsLastTime;
            this.currentFPS = Math.round((this.frameCount * 1000) / timeDiff);
            this.frameCount = 0;
            this.fpsLastTime = timestamp;
            // Update memory usage estimate (simplified)
            this.memoryUsageEstimate = performance.memory ?
                Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0;
            // Auto-performance mode check
            if (this.autoPerformanceModeEnabled && !this.performanceModeActive) {
                if (this.currentFPS < this.lowFPSThreshold) {
                    if (this.lowFPSStartTime === 0) {
                        this.lowFPSStartTime = timestamp;
                    }
                    else if (timestamp - this.lowFPSStartTime >= this.lowFPSDuration) {
                        this.applyPerformanceMode(true);
                        this.lowFPSStartTime = 0;
                    }
                }
                else {
                    this.lowFPSStartTime = 0;
                }
            }
        }
    }
    gameLoop = (timestamp) => {
        if (!this.started || this.isPaused)
            return;
        this.updateFPS(timestamp);
        const deltaTime = Math.min(timestamp - this.lastTime, 50); // Cap at 50ms
        this.lastTime = timestamp;
        this.gameTime = timestamp - this.pausedTime;
        // Handle grace period
        if (this.gracePeriodActive) {
            if (this.gameTime - this.gracePeriodStartTime >= this.gracePeriodDuration) {
                this.gracePeriodActive = false;
            }
        }
        // Update game state
        this.updateCallback(deltaTime);
        // Render
        this.renderCallback();
        this.animationFrame = requestAnimationFrame(this.gameLoop);
    };
    start() {
        if (this.started)
            return;
        this.started = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.gameTime = 0;
        this.pausedTime = 0;
        this.gracePeriodActive = true;
        this.gracePeriodStartTime = 0;
        this.animationFrame = requestAnimationFrame(this.gameLoop);
    }
    stop() {
        this.started = false;
        this.isPaused = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    pause() {
        this.pauseGame();
    }
    resume() {
        this.resumeGame();
    }
    isPausedState() {
        return this.isPaused;
    }
    isStarted() {
        return this.started;
    }
    getGameTime() {
        return this.gameTime;
    }
    isGracePeriodActive() {
        return this.gracePeriodActive;
    }
    getFPS() {
        return this.currentFPS;
    }
    setPerformanceMode(enabled) {
        this.applyPerformanceMode(enabled);
    }
    getPerformanceMode() {
        return this.performanceModeActive;
    }
    setAutoPerformanceModeEnabled(enabled) {
        this.autoPerformanceModeEnabled = enabled;
        this.lowFPSStartTime = 0; // Reset tracking
    }
    getAutoPerformanceModeEnabled() {
        return this.autoPerformanceModeEnabled;
    }
    getPerformanceStats() {
        return {
            fps: this.currentFPS,
            averageFrameTime: this.averageFrameTime,
            memoryUsage: this.memoryUsageEstimate,
            lastScalingEvent: this.lastScalingEvent,
            scalingEventTime: this.scalingEventTime
        };
    }
    cleanup() {
        this.stop();
        window.removeEventListener('blur', this.handleWindowBlur);
        window.removeEventListener('focus', this.handleWindowFocus);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}
