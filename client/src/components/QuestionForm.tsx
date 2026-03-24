type QuestionFormProps = {
  questions: string[];
  answers: string[];
  onChange: (answers: string[]) => void;
};

export default function QuestionForm({ questions, answers, onChange }: QuestionFormProps) {
  return (
    <div className="stack">
      {questions.map((q, index) => (
        <div className="stack" key={q + index}>
          <label>{q}</label>
          <input
            value={answers[index] ?? ""}
            onChange={(event) => {
              const next = [...answers];
              next[index] = event.target.value;
              onChange(next);
            }}
            placeholder="Your answer"
          />
        </div>
      ))}
    </div>
  );
}
