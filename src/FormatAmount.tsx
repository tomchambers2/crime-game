import React from "react";

export function FormatAmount({ number }: { number: number }) {
  return <span>${Math.round(number * 1000) / 1000}</span>;
}
