import "./App.scss";
import "firebase/firestore";
import React, { useState, useEffect } from "react";
import * as firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "./config";
import { Game } from "./Game";

export const solveTransaction = ({ a, b }: firebase.firestore.DocumentData) =>
  a + b;

function App() {
  const [
    gameDb,
    setGameDb,
  ] = useState<firebase.firestore.DocumentReference | null>(null);
  const [gameId, setGameId] = useState("game-id");
  const [playerId, setPlayerId] = useState("Ryan");
  const [playerIdInput, setPlayerIdInput] = useState("");

  useEffect(() => {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore().collection("games");
    setGameDb(db.doc(gameId));
  }, [gameId]);

  useEffect(() => {
    if (!gameDb) return;
    gameDb.collection("player-scores").doc(playerId).set({}, { merge: true });
  });

  if (!gameDb) return <div>"Loading...";</div>;
  if (!playerId)
    return (
      <div>
        <h2>Your employee name</h2>
        <form onSubmit={() => setPlayerId(playerIdInput)}>
          Name:{" "}
          <input
            type="text"
            value={playerIdInput}
            onChange={({ target: { value } }) => setPlayerIdInput(value)}
          />{" "}
          <input disabled={!playerIdInput} type="submit" value="" />
        </form>
      </div>
    );
  return <Game gameDb={gameDb} playerId={playerId} />;
}

export default App;
