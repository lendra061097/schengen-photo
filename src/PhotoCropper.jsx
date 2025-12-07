import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import Slider from "@mui/material/Slider";
import guideline from "./assets/guideline.png";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";

export default function PhotoCropper() {
  const [imageSrc, setImageSrc] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [photoType, setPhotoType] = useState("schengen");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  // ---------------------------
  // AUTO BACKGROUND REMOVAL + FEATHER EDGE
  // ---------------------------
  const autoRemoveBackground = async (dataURL) => {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = dataURL;
      await new Promise((res) => (img.onload = res));

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const segmentation = new SelfieSegmentation({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      segmentation.setOptions({ modelSelection: 1 });

      segmentation.onResults((results) => {
        // Raw mask
        const mask = results.segmentationMask;

        // Feather mask
        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = mask.width;
        blurCanvas.height = mask.height;
        const bctx = blurCanvas.getContext("2d");

        bctx.filter = "blur(0px)"; // feather radius
        bctx.drawImage(mask, 0, 0);

        // Apply mask
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";

        resolve(canvas.toDataURL("image/png"));
      });

      await segmentation.send({ image: img });
    });
  };

  // ---------------------------
  // HANDLE FILE UPLOAD (AUTO REMOVE BG)
  // ---------------------------
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const original = reader.result;
      const cleaned = await autoRemoveBackground(original);

      setImageSrc(cleaned);
      setProcessedImage(cleaned);
    };
    reader.readAsDataURL(file);
  };

  // ---------------------------
  // CROP COMPLETE
  // ---------------------------
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // ---------------------------
  // OUTPUT SIZES (600 DPI)
  // ---------------------------
  const sizes = {
    schengen: { width: 827, height: 1063 }, // 35x45 mm
    us: { width: 1181, height: 1181 }, // 2x2 inch
  };

  // ---------------------------
  // GENERATE FINAL IMAGE
  // ---------------------------
  const generateImage = async () => {
    if (!processedImage || !croppedAreaPixels) return;

    const image = new Image();
    image.src = processedImage;
    await new Promise((resolve) => (image.onload = resolve));

    const outputSize = sizes[photoType];
    const canvas = document.createElement("canvas");
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;

    const ctx = canvas.getContext("2d");

    // Background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cropped face
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const link = document.createElement("a");
    link.download = `${photoType}-photo.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 1);
    link.click();
  };

  // ---------------------------
  // RENDER UI
  // ---------------------------
  return (
    <div style={{ width: "100%", height: "100%", textAlign: "center" }}>
      <h2>Passport / Schengen Photo Maker</h2>

      {/* Upload */}
      <input type="file" accept="image/*" onChange={handleFile} />

      {/* Size Type */}
      <div style={{ margin: "20px 0" }}>
        <label>
          <input
            type="radio"
            checked={photoType === "schengen"}
            onChange={() => setPhotoType("schengen")}
          />
          Schengen (35×45 mm)
        </label>
        &nbsp;&nbsp;
        <label>
          <input
            type="radio"
            checked={photoType === "us"}
            onChange={() => setPhotoType("us")}
          />
          US (2×2 inch)
        </label>
      </div>

      {/* Background Color */}
      <div style={{ marginTop: 20 }}>
        <label>Background Color: </label>
        <select
          value={backgroundColor}
          onChange={(e) => setBackgroundColor(e.target.value)}
        >
          <option value="#ffffff">White</option>
          <option value="#87CEEB">Blue</option>
          <option value="#d9d9d9">Light Gray</option>
          <option value="#f2f2f2">Off White</option>
          <option value="#ff0000">Red</option>
          <option value="#000000">Black</option>
        </select>
      </div>

      {/* Cropper */}
      {processedImage && (
        <div
          style={{
            position: "relative",
            width: 400,
            height: 500,
            margin: "20px auto",
            background: backgroundColor, // live preview
          }}
        >
          <Cropper
            image={processedImage}
            crop={crop}
            zoom={zoom}
            aspect={photoType === "schengen" ? 35 / 45 : 1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />

          {/* Guideline Image */}
          <img
            src={guideline}
            alt="guideline"
            style={{
              position: "absolute",
              top: "20%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "50%",
              height: "55%",
              pointerEvents: "none",
              opacity: 0.9,
            }}
          />
        </div>
      )}

      {/* Zoom Slider */}
      {processedImage && (
        <div style={{ width: 300, margin: "20px auto" }}>
          <label>Zoom</label>
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e, v) => setZoom(v)}
          />
        </div>
      )}

      {/* Download */}
      {processedImage && (
        <button
          onClick={generateImage}
          style={{
            marginTop: 20,
            padding: "10px 20px",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          Download Photo
        </button>
      )}
    </div>
  );
}
