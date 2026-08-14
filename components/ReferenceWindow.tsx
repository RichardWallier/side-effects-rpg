"use client";

const DIFFICULTIES = [
  ["Trivial", 8],
  ["Fácil", 11],
  ["Médio", 14],
  ["Difícil", 17],
  ["Muito Difícil", 20],
  ["Quase Impossível", 23],
] as const;

const KARMA_TIERS = [
  ["Corrupto", "−2 a −5"],
  ["Questionável", "−1"],
  ["Neutro", "0"],
  ["Íntegro", "+1"],
  ["Exemplar", "+2 a +5"],
] as const;

export function ReferenceWindow() {
  return (
    <>
      <h1 className="sheetTitle" style={{ marginBottom: 14 }}>
        Referência Rápida
      </h1>

      <div className="ref-block">
        <h3>Fórmula de teste</h3>
        <div className="formula">d20 + Atributo + Perícia + Karma (passivo) vs Dificuldade</div>
        <div className="note-small">
          Perícia: Destreinado +0 · Treinado +2 · Especialista +4
        </div>
      </div>

      <div className="ref-block">
        <h3>Dificuldade (editar conforme sua mesa)</h3>
        <table className="ref-table">
          <tbody>
            {DIFFICULTIES.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note-small">
          Placeholder — a instrução do projeto não fixou esses números; ajuste livremente.
        </div>
      </div>

      <div className="ref-block">
        <h3>Karma (passivo)</h3>
        <table className="ref-table">
          <tbody>
            {KARMA_TIERS.map(([label, range]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ref-block">
        <h3>Karma (pool ativo)</h3>
        <div className="note-small">
          Gastável tipo Vontade: reroll, converter falha, resistir manipulação. Recarrega só em
          momentos-chave por decisão do mestre.
        </div>
      </div>

      <div className="ref-block">
        <h3>Trilha de ferimento</h3>
        <div className="note-small">
          Ileso → Ferido Leve → Ferido Grave → Incapacitado → Morto. Acerto certeiro pode pular
          direto pra Grave/Morto. Acertar ≠ machucar: dano corpo-a-corpo usa Físico; à distância
          usa perícia + atributo mental/instintivo.
        </div>
      </div>
    </>
  );
}
