import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Graph from "../components/Graph";
import type { Participant as GraphParticipant } from "../components/Graph";
import QuestionForm from "../components/QuestionForm";
import { supabase } from "../lib/supabase";

type RoomRecord = {
  id: string;
  team_name: string;
  questions: string[];
};

type ParticipantRecord = {
  id: string;
  room_id: string;
  name: string;
  answers: string[];
};

export default function Room() {
  const { id: roomId } = useParams();
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [nickname, setNickname] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const graphRef = useRef<any>(null);
  const [exportBg, setExportBg] = useState("#f0f3f6");
  const [exportPadding, setExportPadding] = useState(24);
  const [exportScale, setExportScale] = useState(3);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAnswers, setEditAnswers] = useState<string[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");

  const shareLink = useMemo(() => {
    if (!roomId) return "";
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  const handleDownload = () => {
    const graph = graphRef.current as
      | {
          canvas?: () => HTMLCanvasElement;
          renderer?: () => { domElement: HTMLCanvasElement };
        }
      | null;
    if (!graph) return;

    const sourceCanvas =
      (typeof graph.canvas === "function" ? graph.canvas() : null) ??
      graph.renderer?.().domElement ??
      graphContainerRef.current?.querySelector("canvas") ??
      null;
    if (!sourceCanvas) {
      console.error("Graph canvas not found");
      return;
    }

    const padding = Math.max(0, exportPadding);
    const scale = Math.min(5, Math.max(1, exportScale));
    const exportCanvas = document.createElement("canvas");
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (!width || !height) {
      console.error("Graph canvas has invalid size", { width, height });
      return;
    }
    exportCanvas.width = Math.round((width + padding * 2) * scale);
    exportCanvas.height = Math.round((height + padding * 2) * scale);
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = exportBg;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      width,
      height,
      padding * scale,
      padding * scale,
      width * scale,
      height * scale
    );

    const dataUrl = exportCanvas.toDataURL("image/png");

    if (!dataUrl) return;

    const link = document.createElement("a");
    const safeName = (room?.team_name ?? "team-map").replace(/\\s+/g, "-");
    link.download = `${safeName}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    if (!roomId) return;

    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, team_name, questions")
        .eq("id", roomId)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setRoom(data);
      setAnswers((prev) => {
        const next = [...prev];
        while (next.length < data.questions.length) next.push("");
        return next.slice(0, data.questions.length);
      });
    };

    const fetchParticipants = async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, room_id, name, answers")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setParticipants(data ?? []);
    };

    fetchRoom();
    fetchParticipants();
  }, [roomId]);

  useEffect(() => {
    if (!room) return;
    setAnswers((prev) => {
      const next = [...prev];
      while (next.length < room.questions.length) next.push("");
      return next.slice(0, room.questions.length);
    });
    if (editingId) {
      setEditAnswers((prev) => {
        const next = [...prev];
        while (next.length < room.questions.length) next.push("");
        return next.slice(0, room.questions.length);
      });
    }
  }, [room, editingId]);

  useEffect(() => {
    if (participants.length === 0) {
      setSelectedParticipantId("");
      return;
    }
    if (!selectedParticipantId || !participants.some((p) => p.id === selectedParticipantId)) {
      setSelectedParticipantId(participants[0].id);
    }
  }, [participants, selectedParticipantId]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`participants-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newParticipant = payload.new as ParticipantRecord;
          setParticipants((prev) => {
            if (prev.some((p) => p.id === newParticipant.id)) return prev;
            return [...prev, newParticipant];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as ParticipantRecord;
          setParticipants((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const removed = payload.old as ParticipantRecord;
          setParticipants((prev) => prev.filter((p) => p.id !== removed.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const roomChannel = supabase
      .channel(`rooms-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as RoomRecord;
          setRoom(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomId || !room) return;
    if (!nickname.trim()) return;

    const cleaned = answers.map((answer) => answer.trim());
    if (cleaned.some((answer) => !answer)) return;

    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from("participants")
        .insert({
          room_id: roomId,
          name: nickname.trim(),
          answers: cleaned,
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setParticipants((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev;
          return [...prev, data];
        });
        setNickname("");
        setAnswers(new Array(room.questions.length).fill(""));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!roomId || !room) return;
    const trimmed = newQuestion.trim();
    if (!trimmed) return;

    const updated = [...room.questions, trimmed];
    const { data, error } = await supabase
      .from("rooms")
      .update({ questions: updated })
      .eq("id", roomId)
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setRoom(data);
    setNewQuestion("");
  };

  const startEdit = (participant: ParticipantRecord) => {
    setEditingId(participant.id);
    setEditName(participant.name);
    const nextAnswers = [...participant.answers];
    if (room) {
      while (nextAnswers.length < room.questions.length) nextAnswers.push("");
      nextAnswers.length = room.questions.length;
    }
    setEditAnswers(nextAnswers);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditAnswers([]);
  };

  const saveEdit = async () => {
    if (!editingId || !roomId) return;
    const cleaned = editAnswers.map((answer) => answer.trim());
    if (!editName.trim()) return;

    const { data, error } = await supabase
      .from("participants")
      .update({ name: editName.trim(), answers: cleaned })
      .eq("id", editingId)
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setParticipants((prev) =>
      prev.map((p) => (p.id === editingId ? (data as ParticipantRecord) : p))
    );
    cancelEdit();
  };

  const deleteParticipant = async (participantId: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", participantId);
    if (error) {
      console.error(error);
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    if (editingId === participantId) cancelEdit();
  };

  if (!roomId) {
    return (
      <div className="container">
        <p>Room not found.</p>
      </div>
    );
  }

  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId) ?? null;

  return (
    <div className="container">
      <div className="stack">
        <div>
          <p className="helper">Room</p>
          <h1 className="page-title">{room?.team_name ?? "Loading..."}</h1>
          <p className="helper">Share this link: {shareLink}</p>
        </div>

        <div className="card stack">
          <div className="row">
            <h2 className="section-title">Team map</h2>
            <button type="button" className="secondary" onClick={handleDownload}>
              Download image
            </button>
          </div>
          <div className="row">
            <div className="stack" style={{ minWidth: 180 }}>
              <label>Background</label>
              <input
                type="color"
                value={exportBg}
                onChange={(event) => setExportBg(event.target.value)}
              />
            </div>
            <div className="stack" style={{ minWidth: 160 }}>
              <label>Padding (px)</label>
              <input
                type="number"
                min={0}
                max={200}
                value={exportPadding}
                onChange={(event) => setExportPadding(Number(event.target.value))}
              />
            </div>
            <div className="stack" style={{ minWidth: 160 }}>
              <label>Resolution</label>
              <select
                value={exportScale}
                onChange={(event) => setExportScale(Number(event.target.value))}
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </div>
          <div className="graph-shell">
            {room ? (
              <Graph
                teamName={room.team_name}
                questions={room.questions}
                participants={participants as GraphParticipant[]}
                graphRef={graphRef}
                containerRef={graphContainerRef}
              />
            ) : (
              <p className="helper">Loading graph...</p>
            )}
          </div>
        </div>

        <div className="card stack">
          <div className="stack">
            <h2 className="section-title">Questions</h2>
            <div className="row">
              <input
                placeholder="Add a new question"
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
              />
              <button type="button" className="secondary" onClick={handleAddQuestion}>
                Add
              </button>
            </div>
            {room && (
              <div className="stack">
                {room.questions.map((question, index) => (
                  <div key={`room-q-${index}`} className="helper">
                    {index + 1}. {question}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card stack">
          <h2 className="section-title">Participants</h2>
          <div className="stack">
            {participants.length === 0 ? (
              <p className="helper">No participants yet.</p>
            ) : (
              <>
                <div className="stack">
                  <label>Select participant</label>
                  <select
                    value={selectedParticipantId}
                    onChange={(event) => setSelectedParticipantId(event.target.value)}
                  >
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedParticipant && (
                  <div className="card stack" style={{ borderRadius: 12 }}>
                    <div className="row">
                      <strong>{selectedParticipant.name}</strong>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => startEdit(selectedParticipant)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => deleteParticipant(selectedParticipant.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="stack">
                      {room?.questions.map((question, index) => (
                        <div key={`${selectedParticipant.id}-${index}`} className="helper">
                          <strong>Q:</strong> {question}
                          <br />
                          <strong>A:</strong> {selectedParticipant.answers[index] ?? ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {editingId && room && (
          <div className="card stack">
            <h2 className="section-title">Edit participant</h2>
            <div className="stack">
              <label>Name</label>
              <input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
            <QuestionForm questions={room.questions} answers={editAnswers} onChange={setEditAnswers} />
            <div className="row">
              <button type="button" onClick={saveEdit}>
                Save
              </button>
              <button type="button" className="secondary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <form className="card stack" onSubmit={handleSubmit}>
          <h2 className="section-title">Join this room</h2>

          <div className="stack">
            <label>Nickname</label>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Alex"
            />
          </div>

          {room && (
            <QuestionForm
              questions={room.questions}
              answers={answers}
              onChange={setAnswers}
            />
          )}

          <button type="submit" disabled={submitting || !room}>
            {submitting ? "Submitting..." : "Submit answers"}
          </button>
        </form>
      </div>
    </div>
  );
}
