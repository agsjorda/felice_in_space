type RowOptions = {
    x: number;            // center X of the row
    y: number;            // center Y of the row
    maxWidth: number;     // total width available for the whole row
    gap?: number;         // desired gap between items (unscaled)
    align?: 'center'|'left'|'right'; // horizontal alignment within maxWidth
};

/**
 * Lay out up to 3 containers side-by-side. Excess items are ignored.
 * Automatically scales the set down to fit maxWidth (never scales up).
 */
export function layoutContainersRow(
    scene: Phaser.Scene,
    items: Phaser.GameObjects.Container[],
    opts: RowOptions
) {
    const gap = opts.gap ?? 16;
    const visibleItems = items.slice(0, 3).filter(Boolean);

    // Hide anything not used
    items.forEach((c) => {
        c.setVisible(visibleItems.includes(c));
    });

    if (visibleItems.length === 0) return;

    // Measure natural widths (including current scale) using bounds
    const widths = visibleItems.map((c) => c.getBounds().width);
    const totalNaturalWidth = widths.reduce((a, b) => a + b, 0) + gap * (visibleItems.length - 1);

    // Compute scale to fit within maxWidth (do not upscale)
    const scale = Math.min(1, opts.maxWidth / Math.max(totalNaturalWidth, 1));

    // Compute row width after scale
    const rowWidth = totalNaturalWidth * scale;

    // Determine starting X based on alignment
    let startX = opts.x;
    if (opts.align === 'left') {
        startX = opts.x - opts.maxWidth / 2 + rowWidth / 2;
    } else if (opts.align === 'right') {
        startX = opts.x + opts.maxWidth / 2 - rowWidth / 2;
    }

    // Position each item
    let cursorX = startX - rowWidth / 2;
    visibleItems.forEach((c, index) => {
        const w = widths[index] * scale;
        c.setScale(c.scaleX * scale, c.scaleY * scale);
        // After scaling, use local positions relative to the row
        const localX = cursorX + w / 2;
        c.setPosition(localX, opts.y);
        cursorX += w + gap * scale;
    });
}


