"use client";

import { useCallback, useEffect, useRef } from "react";
import type Sigma from "sigma";

import type { GraphEvent } from "@/lib/domain/types";
import type {
  ProjectedEdgeAttributes,
  ProjectedNodeAttributes,
} from "@/lib/visual/projection";
import { wakeColor } from "@/lib/visual/encodings";
import {
  quadraticControlPoint,
  quadraticPoint,
  quadraticTangent,
  type Point,
} from "@/lib/visual/edgeGeometry";

interface WakeLayerProps {
  renderer: Sigma<ProjectedNodeAttributes, ProjectedEdgeAttributes> | null;
  activeEvent: GraphEvent | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  reducedMotion?: boolean;
}

interface Pulse {
  eventId: string;
  edgeId: string;
  source: string;
  target: string;
  startedAt: number;
  color: string;
  reduced: boolean;
}

function edgeEndpoints(
  event: GraphEvent,
): { edgeId: string; source: string; target: string } | null {
  if (event.type !== "edge.added" || !event.payload || typeof event.payload !== "object") {
    return null;
  }
  const edge = (event.payload as { edge?: unknown }).edge;
  if (!edge || typeof edge !== "object") return null;
  const { id, source, target } = edge as {
    id?: unknown;
    source?: unknown;
    target?: unknown;
  };
  return typeof id === "string" &&
    typeof source === "string" &&
    typeof target === "string"
    ? { edgeId: id, source, target }
    : null;
}

function unitVector(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation = -Math.PI / 2,
) {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index * Math.PI * 2) / sides;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.closePath();
}

function drawNodeShape(
  context: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  radius: number,
) {
  switch (shape) {
    case "square":
      context.beginPath();
      context.rect(x - radius, y - radius, radius * 2, radius * 2);
      break;
    case "diamond":
      drawPolygon(context, x, y, radius * 1.14, 4, 0);
      break;
    case "hexagon":
      drawPolygon(context, x, y, radius * 1.08, 6, 0);
      break;
    case "triangle":
      drawPolygon(context, x, y, radius * 1.18, 3);
      break;
    case "pill":
      context.beginPath();
      context.roundRect(x - radius * 1.35, y - radius * 0.75, radius * 2.7, radius * 1.5, radius);
      break;
    default:
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
  }
}

export function WakeLayer({
  renderer,
  activeEvent,
  selectedNodeId,
  selectedEdgeId,
  reducedMotion,
}: WakeLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<Pulse | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawRef = useRef<(time?: number) => void>(() => undefined);

  const draw = useCallback(
    (time = performance.now()) => {
      const canvas = canvasRef.current;
      if (!canvas || !renderer) return;
      const dimensions = renderer.getDimensions();
      const ratio = window.devicePixelRatio || 1;
      if (
        canvas.width !== Math.round(dimensions.width * ratio) ||
        canvas.height !== Math.round(dimensions.height * ratio)
      ) {
        canvas.width = Math.round(dimensions.width * ratio);
        canvas.height = Math.round(dimensions.height * ratio);
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, dimensions.width, dimensions.height);

      const graph = renderer.getGraph();
      graph.forEachEdge((edgeId, attributes, sourceId, targetId) => {
        const sourceData = renderer.getNodeDisplayData(sourceId);
        const targetData = renderer.getNodeDisplayData(targetId);
        if (!sourceData || !targetData || sourceData.hidden || targetData.hidden) {
          return;
        }
        const source = renderer.framedGraphToViewport(sourceData);
        const target = renderer.framedGraphToViewport(targetData);
        const control = quadraticControlPoint(source, target, attributes.lane);
        const startUnit = unitVector(
          quadraticTangent(source, control, target, 0),
        );
        const endUnit = unitVector(
          quadraticTangent(source, control, target, 1),
        );
        const sourceRadius = Math.max(4, renderer.scaleSize(sourceData.size));
        const targetRadius = Math.max(4, renderer.scaleSize(targetData.size));
        const start = {
          x: source.x + startUnit.x * sourceRadius,
          y: source.y + startUnit.y * sourceRadius,
        };
        const end = {
          x: target.x - endUnit.x * (targetRadius + 4),
          y: target.y - endUnit.y * (targetRadius + 4),
        };

        context.strokeStyle = attributes.color;
        context.fillStyle = attributes.color;
        context.lineWidth =
          attributes.size + (edgeId === selectedEdgeId ? 2 : 0);
        context.setLineDash(attributes.dash);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.quadraticCurveTo(control.x, control.y, end.x, end.y);
        context.stroke();
        context.setLineDash([]);

        const normalX = -endUnit.y;
        const normalY = endUnit.x;
        const arrowSize = 5 + attributes.size;
        const tip = {
          x: target.x - endUnit.x * targetRadius,
          y: target.y - endUnit.y * targetRadius,
        };
        const base = {
          x: tip.x - endUnit.x * arrowSize,
          y: tip.y - endUnit.y * arrowSize,
        };
        context.beginPath();
        context.moveTo(tip.x, tip.y);
        context.lineTo(
          base.x + normalX * arrowSize * 0.65,
          base.y + normalY * arrowSize * 0.65,
        );
        context.lineTo(
          base.x - normalX * arrowSize * 0.65,
          base.y - normalY * arrowSize * 0.65,
        );
        context.closePath();
        context.fill();
      });

      graph.forEachNode((nodeId, attributes) => {
        const display = renderer.getNodeDisplayData(nodeId);
        if (!display || display.hidden) return;
        const point = renderer.framedGraphToViewport({ x: display.x, y: display.y });
        const radius = Math.max(4, renderer.scaleSize(display.size));
        drawNodeShape(context, attributes.shape, point.x, point.y, radius);
        context.fillStyle = attributes.shape === "ring" ? "#dcebe5" : attributes.color;
        context.strokeStyle =
          nodeId === selectedNodeId ? "#151719" : attributes.borderColor;
        context.lineWidth = nodeId === selectedNodeId ? 3 : 1.5;
        context.fill();
        context.stroke();
        if (attributes.shape === "ring") {
          context.beginPath();
          context.arc(point.x, point.y, radius * 0.48, 0, Math.PI * 2);
          context.stroke();
        }
      });

      const pulse = pulseRef.current;
      if (!pulse) return;
      const sourceData = renderer.getNodeDisplayData(pulse.source);
      const targetData = renderer.getNodeDisplayData(pulse.target);
      if (!sourceData || !targetData) {
        pulseRef.current = null;
        return;
      }
      const source = renderer.framedGraphToViewport(sourceData);
      const target = renderer.framedGraphToViewport(targetData);
      const lane = graph.hasEdge(pulse.edgeId)
        ? graph.getEdgeAttribute(pulse.edgeId, "lane")
        : 0;
      const control = quadraticControlPoint(source, target, lane);
      const duration = pulse.reduced ? 180 : 700;
      const progress = Math.min(1, (time - pulse.startedAt) / duration);
      context.strokeStyle = pulse.color;
      context.fillStyle = pulse.color;
      context.lineWidth = 2.5;

      if (pulse.reduced) {
        context.globalAlpha = 1 - progress;
        for (const point of [source, target]) {
          context.beginPath();
          context.arc(point.x, point.y, 12 + progress * 6, 0, Math.PI * 2);
          context.stroke();
        }
      } else {
        const point = quadraticPoint(source, control, target, progress);
        const partialControl = {
          x: source.x + (control.x - source.x) * progress,
          y: source.y + (control.y - source.y) * progress,
        };
        context.globalAlpha = 0.9 * (1 - progress * 0.35);
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.quadraticCurveTo(
          partialControl.x,
          partialControl.y,
          point.x,
          point.y,
        );
        context.stroke();
        context.beginPath();
        context.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      if (progress < 1) {
        frameRef.current = requestAnimationFrame((frameTime) =>
          drawRef.current(frameTime),
        );
      } else {
        pulseRef.current = null;
      }
    },
    [renderer, selectedEdgeId, selectedNodeId],
  );

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    if (!renderer) return;
    renderer.on("afterRender", draw);
    draw();
    return () => {
      renderer.off("afterRender", draw);
    };
  }, [draw, renderer]);

  useEffect(() => {
    if (!renderer || !activeEvent) return;
    const endpoints = edgeEndpoints(activeEvent);
    if (!endpoints) {
      draw();
      return;
    }
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const mediaReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    pulseRef.current = {
      eventId: activeEvent.id,
      edgeId: endpoints.edgeId,
      source: endpoints.source,
      target: endpoints.target,
      startedAt: performance.now(),
      color: wakeColor(activeEvent.type),
      reduced: reducedMotion ?? Boolean(mediaReduced),
    };
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [activeEvent, draw, reducedMotion, renderer]);

  return <canvas ref={canvasRef} className="wake-layer" aria-hidden="true" />;
}
