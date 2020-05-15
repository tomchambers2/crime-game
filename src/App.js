import "./App.scss";
import "firebase/firestore";
import React, { useState, useEffect, useCallback } from "react";
import useInterval from "./useInterval";
import * as firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "./config";
import {
  useCollection,
  useCollectionData,
  useDocumentData,
} from "react-firebase-hooks/firestore";

const solveTransaction = ({ a, b }) => a + b;

function FormatAmount({ number }) {
  return <span>${number}</span>;
}

function App() {
  // const [transactions, setTransactions] = useState([{ a: 53, b: 21 }]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [db, setDb] = useState(null);
  const [gameId, setGameId] = useState("abcd");
  const [gameDb, setGameDb] = useState(null);
  const [name, setName] = useState("Tom");

  useEffect(() => {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore().collection("games");
    setDb(db);
    setGameDb(db.doc(gameId));
    return () => {};
  }, []);

  const [transactions, transactionsLoading, transactionsError] = useCollection(
    gameDb && gameDb.collection("transactions").orderBy("timestamp", "desc"),
    {}
  );
  const [
    completedTransactions,
    completedTransactionsLoading,
    completedTransactionsError,
  ] = useCollection(
    gameDb &&
      gameDb.collection("completed-transactions").orderBy("timestamp", "desc"),
    {}
  );

  const addTransaction = useCallback(() => {
    const newTransaction = {
      a: Math.floor(Math.random() * 100),
      b: Math.floor(Math.random() * 100),
      timestamp: Date.now(),
    };

    gameDb.collection("transactions").add(newTransaction);
  }, [gameDb]);

  const completeTransaction = useCallback(
    (transaction, answer) => {
      gameDb.collection("completed-transactions").add({
        success: parseInt(answer) === solveTransaction(transaction.data()),
        ...transaction.data(),
      });
      transaction.delete();
      setCurrentAnswer("");
    },
    [gameDb]
  );

  useInterval(addTransaction, 10000);

  return (
    <div className="container">
      <div className="transactions">
        <h2>Transactions to enter</h2>
        {!transactionsLoading && !transactionsError && transactions && (
          <ul>
            {transactions.docs.map((doc, i) => {
              console.log("App -> doc", doc);

              const { a, b } = doc.data();
              return (
                <li className={transactions.docs.length - 1 === i && `active`}>
                  #ACCOUNT REF: <FormatAmount number={a} /> +{" "}
                  <FormatAmount number={b} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="solve-input">
        <h2>Enter completed transaction</h2>
        <input
          type="number"
          value={currentAnswer}
          onChange={({ target: { value } }) => setCurrentAnswer(value)}
        />{" "}
        <button
          disabled={!currentAnswer}
          onClick={() => {
            completeTransaction(
              transactions.docs[transactions.docs.length - 1],
              currentAnswer
            );
          }}
        >
          Enter
        </button>
      </div>
      <h2>Completed transactions</h2>
      <div className="total">
        Total:{" "}
        <FormatAmount
          // FIXME: this should not appear until all data sources are loaded
          number={
            completedTransactions &&
            completedTransactions.docs.reduce(
              (acc, transaction) =>
                acc + transaction.data().success
                  ? solveTransaction(transaction.data())
                  : 0,
              0
            )
          }
        />
      </div>
      <div className="completed-transactions">
        {/* FIXME: wait for this */}
        {completedTransactions &&
          completedTransactions.docs.map((transaction) => {
            const { success, a, b } = transaction.data();
            return (
              <li className={!success && `failed`}>
                <FormatAmount number={a} /> + <FormatAmount number={b} />
              </li>
            );
          })}
      </div>
    </div>
  );
}

export default App;
