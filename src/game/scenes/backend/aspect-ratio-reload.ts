export function setupAspectRatioReload(){
    let lastAspectRatio = window.innerWidth / window.innerHeight;
    let lastIsFullscreen = document.fullscreenElement !== null;
    let timeout: number;

    window.addEventListener('resize', () => {
        clearTimeout(timeout);
        timeout = window.setTimeout(() => {
            const currentAspectRatio = window.innerWidth / window.innerHeight;
            const isFullscreen = document.fullscreenElement !== null;

            if (
                Math.abs(currentAspectRatio - lastAspectRatio) > 0.01 ||
                isFullscreen === lastIsFullscreen
            ) {
                location.reload();
            }

            lastAspectRatio = currentAspectRatio;
            lastIsFullscreen = isFullscreen;
        }, 300);
    });
}