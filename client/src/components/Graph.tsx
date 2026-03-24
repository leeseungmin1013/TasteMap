import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide } from "d3-force";

export type Participant = {
  id: string;
  name: string;
  answers: string[];
};

type GraphProps = {
  teamName: string;
  questions: string[];
  participants: Participant[];
  graphRef?: React.MutableRefObject<ForceGraphMethods | undefined>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
};

type GraphNode = {
  id: string;
  label: string;
  type: "team" | "user";
  lines?: string[];
  boxWidth?: number;
  boxHeight?: number;
  accent?: string;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
};

export default function Graph({
  teamName,
  questions,
  participants,
  graphRef,
  containerRef,
}: GraphProps) {
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const activeContainerRef = containerRef ?? internalContainerRef;
  const internalRef = useRef<ForceGraphMethods>();
  const activeRef = graphRef ?? internalRef;
  const [size, setSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!activeContainerRef.current) return;
    const element = activeContainerRef.current;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const colorPalette = [
    "#2f7df6",
    "#ff7a45",
    "#22b07d",
    "#9a6bff",
    "#f7b500",
    "#00bcd4",
    "#ef476f",
    "#7f8c8d",
  ];

  const hashToColor = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 997;
    }
    return colorPalette[hash % colorPalette.length];
  };

  const graphData = useMemo(() => {
    const teamNode: GraphNode = {
      id: "team",
      label: teamName,
      type: "team",
      lines: [teamName],
    };

    const participantNodes: GraphNode[] = participants.map((p) => {
      const qaLines = questions.flatMap((question, index) => {
        const answer = p.answers[index] ?? "";
        return [`Q: ${question}`, `A: ${answer}`];
      });

      return {
        id: p.id,
        label: p.name,
        type: "user",
        lines: [p.name, ...qaLines],
        accent: hashToColor(p.id),
      };
    });

    const nodes = [teamNode, ...participantNodes];

    const links = participants.map((p) => ({
      source: "team",
      target: p.id,
    }));

    return { nodes, links };
  }, [teamName, questions, participants]);

  const wrapLine = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return [text];
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLen) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const measureNode = (ctx: CanvasRenderingContext2D, node: GraphNode, fontSize: number) => {
    const baseLines = node.lines ?? [node.label];
    const wrapWidth = node.type === "team" ? 18 : 24;
    const lines = baseLines.flatMap((line, index) => {
      const max = index === 0 && node.type === "user" ? 18 : wrapWidth;
      return wrapLine(line, max);
    });
    const lineHeight = fontSize + 4;
    ctx.font = `${fontSize}px "Space Grotesk", "Segoe UI", sans-serif`;

    const textWidths = lines.map((line) => ctx.measureText(line).width);
    const maxWidth = Math.max(...textWidths, 40);
    const paddingX = node.type === "team" ? 22 : 18;
    const paddingY = node.type === "team" ? 16 : 12;
    const boxWidth = maxWidth + paddingX * 2;
    const boxHeight = lines.length * lineHeight + paddingY * 2;

    return { lines, lineHeight, boxWidth, boxHeight, paddingY };
  };

  useEffect(() => {
    const graph = activeRef.current;
    if (!graph) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    graphData.nodes.forEach((node) => {
      const typed = node as GraphNode;
      const fontSize = typed.type === "team" ? 14 : 11;
      const { boxWidth, boxHeight } = measureNode(ctx, typed, fontSize);
      const radius = Math.max(boxWidth, boxHeight) / 2 + 28;
      (typed as GraphNode & { __radius: number }).__radius = radius;
    });

    graph.d3Force(
      "collide",
      forceCollide<GraphNode>((node) => (node as GraphNode & { __radius?: number }).__radius ?? 80)
        .strength(1)
        .iterations(2)
    );
  }, [graphData, teamName, questions, participants, activeRef]);

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  };

  return (
    <div ref={activeContainerRef} style={{ width: "100%", height: "100%" }}>
      <ForceGraph2D
        ref={activeRef}
        width={Math.max(200, Math.floor(size.width))}
        height={Math.max(200, Math.floor(size.height))}
        graphData={graphData}
        backgroundColor="#f0f3f6"
        nodeLabel={() => ""}
        nodeColor={(node) =>
          (node as GraphNode).type === "team" ? "#101418" : ((node as GraphNode).accent ?? "#2f7df6")
        }
        nodeVal={(node: GraphNode) => (node.type === "team" ? 18 : 12)}
        linkDistance={(link: GraphLink) => {
          const target = link.target as GraphNode;
          return target?.type === "user" ? 240 : 200;
        }}
        linkColor={() => "#c7cdd4"}
        linkWidth={1.5}
        cooldownTicks={60}
        d3VelocityDecay={0.2}
        enableNodeDrag
        onNodeDrag={(node: GraphNode) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        onNodeDragEnd={(node: GraphNode) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const typed = node as GraphNode;
          const fontSize = (typed.type === "team" ? 14 : 11) / globalScale;
          const { lines, lineHeight, boxWidth, boxHeight, paddingY } =
            measureNode(ctx, typed, fontSize);

          typed.boxWidth = boxWidth;
          typed.boxHeight = boxHeight;

          const x = (typed.x ?? 0) - boxWidth / 2;
          const y = (typed.y ?? 0) - boxHeight / 2;

          ctx.save();
          const accent = typed.accent ?? "#2f7df6";
          ctx.fillStyle = typed.type === "team" ? "#101418" : "#ffffff";
          ctx.strokeStyle = typed.type === "team" ? "#101418" : accent;
          ctx.lineWidth = 1.2 / globalScale;
          drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 12 / globalScale);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = typed.type === "team" ? "#ffffff" : "#101418";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const startY = y + paddingY;
          lines.forEach((line, index) => {
            if (typed.type === "user" && index === 0) {
              ctx.font = `600 ${12 / globalScale}px "Space Grotesk", "Segoe UI", sans-serif`;
              ctx.fillStyle = "#101418";
            } else if (typed.type === "user" && line.startsWith("Q:")) {
              ctx.font = `600 ${10.5 / globalScale}px "Space Grotesk", "Segoe UI", sans-serif`;
              ctx.fillStyle = accent;
            } else if (typed.type === "user" && line.startsWith("A:")) {
              ctx.font = `400 ${10.5 / globalScale}px "Space Grotesk", "Segoe UI", sans-serif`;
              ctx.fillStyle = "#2c3238";
            } else {
              ctx.font = `${fontSize}px "Space Grotesk", "Segoe UI", sans-serif`;
              ctx.fillStyle = typed.type === "team" ? "#ffffff" : "#101418";
            }
            ctx.fillText(line, typed.x ?? 0, startY + index * lineHeight);
          });
          ctx.restore();
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const typed = node as GraphNode;
          const width = typed.boxWidth ?? 120;
          const height = typed.boxHeight ?? 60;
          ctx.fillStyle = color;
          drawRoundedRect(
            ctx,
            (node.x ?? 0) - width / 2,
            (node.y ?? 0) - height / 2,
            width,
            height,
            12
          );
          ctx.fill();
        }}
      />
    </div>
  );
}
