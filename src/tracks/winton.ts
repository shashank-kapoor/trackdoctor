import type { TrackDef } from '../lib/types';

/**
 * Winton Motor Raceway — Long circuit (Old Tower start/finish), Benalla VIC.
 * Corner numbers are counted from the timing line and may not match official numbering.
 */
export const winton: TrackDef = {
  id: 'winton-long',
  name: 'Winton Long',
  venue: 'Winton Motor Raceway',
  location: 'Benalla, VIC, Australia',
  lengthM: 2900,
  startLine: [
    [-36.5167245, 146.084473],
    [-36.5169939, 146.084026],
  ],
  center: [-36.51855, 146.0872],
  zoom: 16,
  available: true,
  corners: [
    {
      id: 'T1',
      name: 'Turn 1',
      direction: 'R',
      kind: 'fast',
      apex: [-36.5156534, 146.0834687],
      blurb: 'Fast right off the front straight',
      tips: [
        'Brake once in a straight line, then trail off as you turn in. Aim to be back on throttle before the apex.',
        'A clean exit here sets up your speed through the long T2 arc.',
      ],
    },
    {
      id: 'T2',
      name: 'Turn 2',
      direction: 'R',
      kind: 'sweeper',
      apex: [-36.5152497, 146.0851322],
      blurb: 'Long right-hand arc',
      tips: [
        'Treat T2 as one long arc. Settle the car on a light, steady throttle and hold it.',
        "Don't brake or lift part-way through. If the car pushes wide, open the steering slightly rather than lifting.",
      ],
    },
    {
      id: 'T3',
      name: 'Turn 3',
      direction: 'L',
      kind: 'sweeper',
      apex: [-36.5170238, 146.0874492],
      blurb: 'Long left — a commitment corner',
      tips: [
        'This corner is about commitment, not braking. Lift only briefly, turn in, and get back to throttle early.',
        'A better T2 exit lets you arrive faster here, so the two corners work as a pair.',
      ],
    },
    {
      id: 'T4',
      name: 'Turn 4',
      direction: 'R',
      kind: 'hairpin',
      apex: [-36.5155406, 146.0898545],
      blurb: 'Right hairpin',
      tips: [
        'Brake in a straight line, then gradually ease off the brake as you turn in.',
        'Turn in slightly later than feels natural so you can get on the throttle earlier.',
        'Hold speed through the left flick that follows; a strong exit lets you carry ~80 km/h there.',
      ],
    },
    {
      id: 'T5',
      name: 'Turn 5',
      direction: 'R',
      kind: 'hairpin',
      apex: [-36.5166562, 146.0909046],
      blurb: 'Right hairpin',
      tips: [
        'Brake a touch earlier and keep the car turning at a steady speed. Hit the apex on time.',
        'Then open the steering and go to full throttle — a good exit pays all the way down the run to T6.',
      ],
    },
    {
      id: 'T6',
      name: 'Turn 6',
      direction: 'L',
      kind: 'hairpin',
      apex: [-36.5186147, 146.0879201],
      blurb: 'Left hairpin after a 150 km/h run',
      tips: [
        'Slow in, fast out. Brake a few metres earlier and ease off the brake gradually.',
        'Throttle from the apex. Braking later here has tended to make the lap slower, not faster.',
      ],
    },
    {
      id: 'T7',
      name: 'Turn 7',
      direction: 'R',
      kind: 'complex',
      apex: [-36.5212944, 146.0909976],
      blurb: 'Double right, first apex',
      tips: [
        "Don't chase extra entry speed into T7 — it's the first half of a pair.",
        'A slightly later turn-in sets up a tighter line into T8.',
      ],
    },
    {
      id: 'T8',
      name: 'Turn 8',
      direction: 'R',
      kind: 'complex',
      apex: [-36.5218617, 146.0899592],
      blurb: 'Second apex, onto the back straight',
      tips: [
        'Focus on the second apex: it leads onto the longest straight on the track.',
        'Get to full throttle as early as possible; every km/h here lasts all the way to T9.',
      ],
    },
    {
      id: 'T9',
      name: 'Turn 9',
      direction: 'L',
      kind: 'heavy-brake',
      apex: [-36.5181829, 146.08632],
      blurb: 'Left at the end of the back straight (~190 km/h)',
      tips: [
        'Brake firmly in a straight line, then let off the brake progressively as you turn in.',
        'The goal is to carry speed through the corner, not to brake as late as possible.',
        'Prioritise the exit — it is your run to the finish line.',
      ],
    },
  ],
  outline: [[-36.516859,146.084249],[-36.516715,146.084115],[-36.516571,146.08398],[-36.516428,146.083844],[-36.516285,146.083707],[-36.516132,146.083589],[-36.515969,146.083496],[-36.515795,146.083453],[-36.515622,146.083491],[-36.51548,146.083622],[-36.515382,146.083809],[-36.515313,146.084016],[-36.515245,146.084224],[-36.515184,146.084435],[-36.515139,146.08465],[-36.515145,146.084875],[-36.515223,146.085074],[-36.515346,146.085232],[-36.515494,146.08536],[-36.515652,146.085466],[-36.515809,146.085576],[-36.515965,146.085688],[-36.516117,146.085809],[-36.516268,146.085932],[-36.516415,146.08606],[-36.516558,146.086197],[-36.516697,146.08634],[-36.516815,146.086509],[-36.516915,146.086694],[-36.516993,146.086895],[-36.51703,146.087114],[-36.517029,146.087337],[-36.517001,146.087557],[-36.516948,146.087771],[-36.516862,146.087968],[-36.516753,146.088145],[-36.516622,146.088297],[-36.516461,146.088397],[-36.516287,146.088448],[-36.516111,146.088492],[-36.51594,146.088559],[-36.515793,146.088688],[-36.515674,146.088855],[-36.51557,146.089038],[-36.515483,146.089234],[-36.515428,146.089445],[-36.515429,146.089666],[-36.515525,146.089846],[-36.515698,146.089857],[-36.515857,146.089753],[-36.516009,146.089632],[-36.516169,146.089533],[-36.516344,146.08948],[-36.516522,146.089498],[-36.516681,146.089597],[-36.516784,146.089775],[-36.516804,146.089992],[-36.516733,146.090192],[-36.516624,146.09037],[-36.516561,146.090577],[-36.516597,146.090793],[-36.516721,146.090944],[-36.516893,146.090943],[-36.517039,146.090816],[-36.517139,146.090631],[-36.517218,146.09043],[-36.517292,146.090225],[-36.517364,146.090019],[-36.517438,146.089815],[-36.517514,146.089612],[-36.517593,146.089411],[-36.517672,146.089209],[-36.517753,146.089008],[-36.517833,146.088808],[-36.517916,146.088608],[-36.517999,146.08841],[-36.518084,146.088212],[-36.518194,146.088034],[-36.518334,146.087896],[-36.518511,146.087882],[-36.518672,146.087974],[-36.518812,146.088116],[-36.518946,146.088266],[-36.51908,146.088415],[-36.519214,146.088565],[-36.519347,146.088716],[-36.519478,146.088871],[-36.519606,146.089028],[-36.51973,146.089191],[-36.519853,146.089354],[-36.519975,146.08952],[-36.520097,146.089685],[-36.520219,146.089849],[-36.520342,146.090014],[-36.520467,146.090176],[-36.520592,146.090337],[-36.520717,146.090498],[-36.520844,146.090657],[-36.520973,146.090814],[-36.521122,146.09094],[-36.521294,146.090998],[-36.521465,146.090935],[-36.521602,146.09079],[-36.521718,146.090619],[-36.52182,146.090434],[-36.52188,146.090223],[-36.521868,146.090003],[-36.52178,146.089812],[-36.521645,146.089665],[-36.521497,146.089538],[-36.521345,146.089418],[-36.521196,146.089292],[-36.521047,146.089165],[-36.520901,146.089033],[-36.520756,146.0889],[-36.520613,146.088765],[-36.520469,146.08863],[-36.520326,146.088493],[-36.520183,146.088357],[-36.520041,146.088219],[-36.519899,146.088081],[-36.519756,146.087944],[-36.519614,146.087807],[-36.519471,146.08767],[-36.519328,146.087534],[-36.519185,146.087398],[-36.519041,146.087262],[-36.518897,146.087128],[-36.518752,146.086994],[-36.518608,146.08686],[-36.518464,146.086724],[-36.518335,146.086569],[-36.518223,146.086394],[-36.518156,146.08619],[-36.518135,146.085968],[-36.518122,146.085745],[-36.51809,146.085525],[-36.518004,146.085329],[-36.517885,146.085163],[-36.517751,146.085014],[-36.517604,146.084884],[-36.517457,146.084755],[-36.51731,146.084625],[-36.517164,146.084493],[-36.517019,146.08436],[-36.516875,146.084226]],
};
