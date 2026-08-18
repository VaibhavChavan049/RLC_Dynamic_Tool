// Small hand-rolled fraction/radical renderers for the metric cards --
// pulling in a full math-typesetting library (KaTeX etc.) for five short
// formulas would be a lot of bundle weight for very little payoff, and
// these formulas are simple enough (single fraction, single radical) that
// plain flexbox reproduces the textbook look just fine.
export function Fraction({ num, den }: { num: React.ReactNode; den: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "middle",
        lineHeight: 1.15,
      }}
    >
      <span style={{ padding: "0 0.15em" }}>{num}</span>
      <span style={{ borderTop: "1.4px solid currentColor", padding: "0 0.15em" }}>{den}</span>
    </span>
  );
}

export function Sqrt({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-start", verticalAlign: "middle" }}>
      <span style={{ marginRight: "0.05em" }}>√</span>
      <span style={{ borderTop: "1.4px solid currentColor", padding: "0 0.1em" }}>{children}</span>
    </span>
  );
}
