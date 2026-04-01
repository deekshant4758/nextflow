"use client";

import type { WorkflowNode, WorkflowRun } from "@/types/workflow";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

function loadVideo(src: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    if (/^https?:/i.test(src)) {
      video.crossOrigin = "anonymous";
    }
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Failed to load video"));
    video.src = src;
  });
}

function parseTimestamp(timestamp: string, duration: number) {
  const trimmed = timestamp.trim();
  if (trimmed.endsWith("%")) {
    const percentage = Number.parseFloat(trimmed.replace("%", ""));
    if (Number.isFinite(percentage)) {
      return Math.min(duration, Math.max(0, (duration * percentage) / 100));
    }
  }

  const seconds = Number.parseFloat(trimmed);
  if (Number.isFinite(seconds)) {
    return Math.min(duration, Math.max(0, seconds));
  }

  return 0;
}

async function createCroppedImage(node: WorkflowNode) {
  if (node.data.nodeType !== "cropImage" || !node.data.imageUrl) {
    return undefined;
  }

  const image = await loadImage(node.data.imageUrl);
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round((image.width * Number.parseFloat(node.data.widthPercent || "100")) / 100));
  const height = Math.max(1, Math.round((image.height * Number.parseFloat(node.data.heightPercent || "100")) / 100));
  const sx = Math.max(0, Math.round((image.width * Number.parseFloat(node.data.xPercent || "0")) / 100));
  const sy = Math.max(0, Math.round((image.height * Number.parseFloat(node.data.yPercent || "0")) / 100));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return undefined;
  }

  context.drawImage(image, sx, sy, width, height, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

async function createExtractedFrame(node: WorkflowNode) {
  if (node.data.nodeType !== "extractFrame" || !node.data.videoUrl) {
    return undefined;
  }

  const video = await loadVideo(node.data.videoUrl);

  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      const handleLoadedData = () => {
        video.removeEventListener("loadeddata", handleLoadedData);
        resolve();
      };

      video.addEventListener("loadeddata", handleLoadedData);
    });
  }

  const targetTime = parseTimestamp(node.data.timestamp, video.duration || 0);

  await new Promise<void>((resolve) => {
    const handleSeeked = () => {
      video.removeEventListener("seeked", handleSeeked);
      resolve();
    };

    video.addEventListener("seeked", handleSeeked);
    try {
      video.currentTime = targetTime;
    } catch {
      video.removeEventListener("seeked", handleSeeked);
      resolve();
    }
  });

  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const context = canvas.getContext("2d");
  if (!context) {
    return undefined;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export async function materializeMediaOutputs(nodes: WorkflowNode[], run: WorkflowRun) {
  const nextNodes = [...nodes];
  const nextRun: WorkflowRun = {
    ...run,
    nodeRuns: [...run.nodeRuns],
  };

  for (let index = 0; index < nextNodes.length; index += 1) {
    const node = nextNodes[index];

    try {
      if (node.data.nodeType === "cropImage") {
        const cropped = await createCroppedImage(node);
        if (cropped) {
          nextNodes[index] = {
            ...node,
            data: {
              ...node.data,
              result: cropped,
            },
          };
          const runIndex = nextRun.nodeRuns.findIndex((item) => item.nodeId === node.id);
          if (runIndex >= 0) {
            nextRun.nodeRuns[runIndex] = {
              ...nextRun.nodeRuns[runIndex],
              output: cropped,
            };
          }
        }
      }

      if (node.data.nodeType === "extractFrame") {
        const frame = await createExtractedFrame(node);
        if (frame) {
          nextNodes[index] = {
            ...node,
            data: {
              ...node.data,
              result: frame,
            },
          };
          const runIndex = nextRun.nodeRuns.findIndex((item) => item.nodeId === node.id);
          if (runIndex >= 0) {
            nextRun.nodeRuns[runIndex] = {
              ...nextRun.nodeRuns[runIndex],
              output: frame,
            };
          }
        }
      }
    } catch {
      continue;
    }
  }

  return { nodes: nextNodes, run: nextRun };
}
