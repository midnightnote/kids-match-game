// 問題データ：silhouetteSvg は黒塗り版、cards は通常版
// ここを増やしていけば問題が増えます。

const mk = (svgBody, fill) => `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="${fill}" stroke="rgba(255,255,255,.12)" stroke-width="2">
    ${svgBody}
  </g>
</svg>
`;

const SHAPES = {
  apple: `<path d="M63 28c6-10 15-10 18-9-2 7-8 12-14 13z"/>
          <path d="M60 36c-20 0-32 14-32 34 0 22 14 40 32 40s32-18 32-40c0-20-12-34-32-34z"/>`,
  fish: `<path d="M16 60c18-26 56-30 78-12 8-8 16-12 18-12-4 12-4 36 0 48-2 0-10-4-18-12-22 18-60 14-78-12z"/>
         <circle cx="70" cy="55" r="5"/>`,
  car: `<path d="M25 70h70c6 0 10 4 10 10v10H15V80c0-6 4-10 10-10z"/>
        <path d="M35 70l10-22h30l10 22z"/>
        <circle cx="35" cy="92" r="10"/>
        <circle cx="85" cy="92" r="10"/>`
};

const COLORS = ["#ff4d6d", "#ffd166", "#4cc9f0", "#7CFF6B", "#c77dff"];

export const QUESTIONS = [
  {
    id: "q_apple",
    correctCardId: "apple",
    silhouetteSvg: mk(SHAPES.apple, "#000000"),
    cards: [
      { id: "apple", svg: mk(SHAPES.apple, COLORS[1]) },
      { id: "fish",  svg: mk(SHAPES.fish,  COLORS[2]) },
      { id: "car",   svg: mk(SHAPES.car,   COLORS[4]) }
    ]
  },
  {
    id: "q_fish",
    correctCardId: "fish",
    silhouetteSvg: mk(SHAPES.fish, "#000000"),
    cards: [
      { id: "car",   svg: mk(SHAPES.car,   COLORS[4]) },
      { id: "fish",  svg: mk(SHAPES.fish,  COLORS[2]) },
      { id: "apple", svg: mk(SHAPES.apple, COLORS[1]) }
    ]
  },
  {
    id: "q_car",
    correctCardId: "car",
    silhouetteSvg: mk(SHAPES.car, "#000000"),
    cards: [
      { id: "fish",  svg: mk(SHAPES.fish,  COLORS[2]) },
      { id: "apple", svg: mk(SHAPES.apple, COLORS[1]) },
      { id: "car",   svg: mk(SHAPES.car,   COLORS[4]) }
    ]
  }
];