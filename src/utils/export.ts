import Konva from "konva";

// =============================================================
// EXPORT UTILITIES — Download board as PNG or PDF
// =============================================================
//
// HOW CANVAS EXPORT WORKS:
// 1. Konva's stage.toDataURL() renders all layers to a pixel image
// 2. Returns a base64 data URL (like "data:image/png;base64,...")
// 3. We create an <a> tag with download attribute and click it
//
// WHY RESET TRANSFORM BEFORE EXPORT?
// The stage might be zoomed in or panned. If we export as-is,
// we'd only get what's visible on screen. Instead, we:
// 1. Save current zoom/pan
// 2. Calculate bounding box of ALL elements
// 3. Set transform to show everything
// 4. Export
// 5. Restore original zoom/pan
//
// ALTERNATIVE: Use html2canvas (captures the HTML DOM as image).
// But Konva's built-in export is faster and higher quality.

export async function exportToPNG(stage: Konva.Stage) {
  // Temporarily reset transform to capture all content
  const oldScale = { x: stage.scaleX(), y: stage.scaleY() };
  const oldPos = { x: stage.x(), y: stage.y() };

  // Find bounding box of all elements
  const layer = stage.getLayers()[0];
  if (!layer) return;

  const bounds = layer.getClientRect({ skipTransform: true });

  // Add padding
  const padding = 40;
  const x = bounds.x - padding;
  const y = bounds.y - padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  // If nothing on canvas, use default size
  const exportWidth = width > 0 ? width : 800;
  const exportHeight = height > 0 ? height : 600;

  // Reset transform to show all content
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: -x, y: -y });
  stage.batchDraw();

  const dataURL = stage.toDataURL({
    pixelRatio: 2, // 2x for retina quality
    width: exportWidth,
    height: exportHeight,
    mimeType: "image/png",
  });

  // Restore original transform
  stage.scale(oldScale);
  stage.position(oldPos);
  stage.batchDraw();

  // Trigger download
  downloadDataURL(dataURL, "whiteboard.png");
}

export async function exportToPDF(stage: Konva.Stage) {
  // Dynamic import to avoid loading jspdf unless needed
  const { jsPDF } = await import("jspdf");

  const layer = stage.getLayers()[0];
  if (!layer) return;

  const oldScale = { x: stage.scaleX(), y: stage.scaleY() };
  const oldPos = { x: stage.x(), y: stage.y() };

  const bounds = layer.getClientRect({ skipTransform: true });
  const padding = 40;
  const x = bounds.x - padding;
  const y = bounds.y - padding;
  const width = (bounds.width > 0 ? bounds.width : 800) + padding * 2;
  const height = (bounds.height > 0 ? bounds.height : 600) + padding * 2;

  stage.scale({ x: 1, y: 1 });
  stage.position({ x: -x, y: -y });
  stage.batchDraw();

  const dataURL = stage.toDataURL({
    pixelRatio: 2,
    width,
    height,
    mimeType: "image/png",
  });

  // Restore
  stage.scale(oldScale);
  stage.position(oldPos);
  stage.batchDraw();

  // Create PDF
  // WHY LANDSCAPE?
  // Whiteboards are typically wider than tall.
  // We auto-detect orientation based on content.
  const orientation = width > height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [width, height],
  });

  pdf.addImage(dataURL, "PNG", 0, 0, width, height);
  pdf.save("whiteboard.pdf");
}

function downloadDataURL(dataURL: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
