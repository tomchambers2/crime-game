/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useCallback, FunctionComponent } from "react";
import useInterval from "./useInterval";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { FormatAmount } from "./FormatAmount";
import { solveTransaction } from "./App";
import * as firebase from "firebase/app";
import { useToggle } from "react-use";
import Noty from "noty";
import "noty/src/noty.scss";
import "noty/src/themes/mint.scss";
import { Modal, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Countdown from "react-countdown";

interface Game {
  gameDb: firebase.firestore.DocumentReference;
  playerId: string;
}
export const Game: FunctionComponent<Game> = ({ gameDb, playerId }) => {
  const [skimming, toggleSkimming] = useToggle(false);
  const [skimAmount, setSkimAmount] = useState(0.01);
  const [transactionCount, setTransactionCount] = useState(0);
  const [skimModalOpen, setSkimModalOpen] = useState(false);

  const [currentAnswer, setCurrentAnswer] = useState("");
  const [playerScores, playerScoresLoading, playerScoresError] = useCollection(
    gameDb.collection("player-scores")
  );
  const [transactions, transactionsLoading, transactionsError] = useCollection(
    gameDb.collection("transactions").orderBy("timestamp", "desc"),
    {}
  );
  const completedTransactionsRef = gameDb.collection("completed");
  const [
    completedTransactions,
    completedTransactionsLoading,
    completedTransactionsError,
  ] = useCollection(completedTransactionsRef);

  const [countdown] = useDocument(
    gameDb.collection("game-info").doc("countdown")
  );

  if (!countdown?.data()) {
    countdown?.ref.set({ endTime: Date.now() + 15 * 1000 * 60 });
  }

  const updatePlayerScore = useCallback(
    (change) => {
      // FIXME: pattern to avoid checking all the time and silent failure
      gameDb
        .collection("player-scores")
        .doc(playerId)
        .update({ score: firebase.firestore.FieldValue.increment(change) });
    },
    [gameDb, playerId]
  );
  const addTransaction = useCallback(() => {
    if (transactions && transactions?.docs.length >= 10) return;
    const newTransaction = {
      a: Math.floor(Math.random() * 10),
      b: Math.floor(Math.random() * 10),
      timestamp: Date.now(),
    };

    gameDb.collection("transactions").add(newTransaction);
  }, [gameDb, transactions]);

  const completeTransaction = useCallback(
    (transaction, answer) => {
      const { a, b } = transaction.data();

      const success = parseInt(answer) === solveTransaction(transaction.data());

      let transactionFee = 0.1;
      if (success) {
        if (skimming) {
          transactionFee += skimAmount;
          toggleSkimming();
          setSkimAmount(skimAmount * 2);
        }

        completedTransactionsRef.add({
          success,
          total: a + b - transactionFee,
        });
        updatePlayerScore(skimAmount);

        // FIXME: tie this into websocket notifications to share amongst all

        new Noty({
          text: `Transaction success, ${transactionFee} earned`,
          type: "success",
          timeout: 3000,
        }).show();
      } else {
        updatePlayerScore(-transactionFee);
        new Noty({
          text: `Transaction failed, -${transactionFee} deducted`,
          type: "error",
          timeout: 3000,
        }).show();
      }

      transaction.ref.delete();
      setCurrentAnswer("");

      setTransactionCount((transactionCount) => transactionCount + 1);
      if ((transactionCount + 1) % 3 === 0) {
        setSkimModalOpen(true);
      }
    },
    [gameDb, updatePlayerScore, transactionCount]
  );

  useInterval(addTransaction, 10000);

  console.log(
    countdown?.exists && countdown.data && countdown?.data()?.endTime
  );

  return (
    <>
      <Modal show={skimModalOpen}>
        <Modal.Dialog>
          <Modal.Header closeButton>
            <Modal.Title>Want to make a little extra?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <p>You're doing well. We'd like to offer you a little deal.</p>
            <p>
              You can take <FormatAmount number={skimAmount}></FormatAmount> as
              an extra large fee on the next transaction. Nobody else will know.
              This offer is only being made to you, other employees will not see
              this.
            </p>
            <p>
              The real winner of the game is the person with the highest fees
              personally.
            </p>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setSkimModalOpen(false)}>
              Not this time
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toggleSkimming();
                setSkimModalOpen(false);
              }}
            >
              Take deal
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal>
      <div className="container">
        <div className="countdown-container">
          {countdown?.data()?.endTime}
          <Countdown
            date={countdown?.data()?.endTime}
            // date={Date.now() + 1000}
            // date={Date.now() + 10000}
            renderer={(props) => <div>{props.total}</div>}
            intervalDelay={0}
          />
          {/* <Countdown
            date={Date.now() + 10000}
            precision={3}
            renderer={(props) => <div>{props.total}</div>}
          /> */}
        </div>
        <div>
          <h2>
            Skim? {skimming ? "ON" : "OFF"}{" "}
            <button onClick={toggleSkimming}>Toggle</button>
          </h2>
        </div>
        <div className="transactions">
          <h2>Transactions to enter</h2>
          {!transactionsLoading && !transactionsError && transactions && (
            <ul>
              {transactions.docs.map((doc, i) => {
                const { a, b } = doc.data();
                return (
                  <li
                    key={i}
                    className={
                      (transactions.docs.length - 1 === i && `active`) || ""
                    }
                  >
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
                transactions && transactions.docs[transactions.docs.length - 1],
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
              (completedTransactions &&
                completedTransactions.docs.reduce(
                  (acc, transaction) => acc + transaction.data().total,
                  0
                )) ||
              999
            }
          />
        </div>
        {/* <div className="completed-transactions">
        {completedTransactions &&
          completedTransactions.docs.map((transaction, i) => {
            const { success, total } = transaction.data();
            return (
              <li className={(!success && `failed`) || ""} key={i}>
                <FormatAmount number={total} />
              </li>
            );
          })}
      </div> */}
        <h2>Group fees earned</h2>
        <div>
          <FormatAmount
            number={
              (playerScores &&
                playerScores.docs.reduce(
                  (acc, doc) => doc.data().score + acc,
                  0
                )) ||
              0
            }
          ></FormatAmount>
        </div>
        <h2>Player scores</h2>
        <div>
          <ul>
            {playerScores &&
              playerScores.docs
                .filter(({ id }) => id === playerId)
                .map((doc, i) => (
                  <li key={i}>
                    {doc.id}:{" "}
                    <FormatAmount number={doc.data().score}></FormatAmount>
                  </li>
                ))}
          </ul>
        </div>
      </div>
    </>
  );
};
