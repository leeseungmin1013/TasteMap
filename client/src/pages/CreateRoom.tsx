import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function CreateRoom() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [questions, setQuestions] = useState<string[]>(["What should we celebrate this week?"]);
  const [loading, setLoading] = useState(false);

  const updateQuestion = (index: number, value: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addQuestion = () => setQuestions((prev) => [...prev, ""]);
  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamName.trim()) return;

    const cleaned = questions.map((q) => q.trim()).filter(Boolean);
    if (cleaned.length === 0) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rooms")
        .insert({ team_name: teamName.trim(), questions: cleaned })
        .select()
        .single();

      if (error) {
        console.error(error);
        return;
      }

      if (data?.id) {
        navigate(`/room/${data.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="stack">
        <div>
          <p className="helper">Create room</p>
          <h1 className="page-title">Set up your team preference map.</h1>
        </div>

        <form className="card stack" onSubmit={handleSubmit}>
          <div className="stack">
            <label>Team name</label>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Design Crew"
            />
          </div>

          <div className="stack">
            <div className="row">
              <h2 className="section-title">Questions</h2>
              <button type="button" className="secondary" onClick={addQuestion}>
                Add question
              </button>
            </div>

            {questions.map((question, index) => (
              <div className="stack" key={`q-${index}`}>
                <label>Question {index + 1}</label>
                <textarea
                  rows={2}
                  value={question}
                  onChange={(event) => updateQuestion(index, event.target.value)}
                  placeholder="Ask something your team should answer"
                />
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeQuestion(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create room"}
          </button>
        </form>
      </div>
    </div>
  );
}
