import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  return (
    <div className="container">
      <div className="stack">
        <div>
          <p className="helper">Team Preference Map</p>
          <h1 className="page-title">See your team take shape in real time.</h1>
          <p className="helper">
            Create a room, share the link, and watch participant nodes orbit your team.
          </p>
        </div>

        <div className="card stack">
          <div className="row">
            <Link to="/create">
              <button>Create a room</button>
            </Link>
            <span className="helper">or jump into an existing room</span>
          </div>

          <div className="stack">
            <label>Room ID</label>
            <input
              placeholder="Paste room UUID"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value.trim())}
            />
            <button
              className="secondary"
              onClick={() => roomId && navigate(`/room/${roomId}`)}
              disabled={!roomId}
            >
              Join room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
