import React, { useState } from "react";
import { streamLyra } from "../utils/streamLyra";

export default function LyraStreamDemo() {
  const [question, setQuestion] = useState("Comment canaliser mon énergie cette semaine ?");
  const [cards, setCards] = useState(["La Force (XI)","Le Bateleur (I)","La Tempérance (XIV)"]);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");

  const onSend = async () => {
    setOutput("");
    setStatus("streaming");
    streamLyra(
      { name: "Yoann", question, cards },
      (text) => setOutput((prev) => prev + text),
      () => setStatus("done"),
      () => setStatus("error"),
    );
  };

  return (
    <div style={{maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui"}}>
      <h2>LyraStreamDemo</h2>
      <label style={{display:"block", marginBottom:8}}>Question</label>
      <input
        style={{width:"100%", padding:8, marginBottom:12}}
        value={question}
        onChange={(e)=>setQuestion(e.target.value)}
      />
      <label style={{display:"block", marginBottom:8}}>Cartes (JSON)</label>
      <input
        style={{width:"100%", padding:8, marginBottom:12}}
        value={JSON.stringify(cards)}
        onChange={(e)=>{
          try { setCards(JSON.parse(e.target.value)); } catch {}
        }}
      />
      <button onClick={onSend} disabled={status==="streaming"}>Tirer & streamer</button>
      <div style={{whiteSpace:"pre-wrap", padding:"12px 0", borderTop:"1px solid #ddd", marginTop:16}}>
        {output || (status==="streaming" ? "…" : "—")}
      </div>
      <small>status: {status}</small>
    </div>
  );
}