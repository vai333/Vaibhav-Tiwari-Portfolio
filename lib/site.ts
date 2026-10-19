// Personal details used by the overlay. Leave a social link empty to hide its icon.
export const site = {
  name: "Vaibhav Tiwari",
  email: "vaibhavbhav333@gmail.com",
  socials: {
    github: "https://github.com/vai333",
    linkedin: "https://www.linkedin.com/in/vaibhav-tiwari333",
    leetcode: "https://leetcode.com/u/vai_333/",
    instagram: "",
  },
} as const;

/**
 * A tag that pops in during its chapter. `mark` fills the gold disc (★ for wins, a figure for stats);
 * `at` is when it appears, as a fraction (0–1) of the chapter's on-screen window.
 */
export type Tag = { mark: string; kicker: string; title: string; at: number };

export const phases = [
  {
    id: "drive",
    index: "01",
    title: "The Early Drive",
    kicker: "Public speaking & athletics",
    body: "It started with a voice and a run-up. Speaking on stage taught me to hold a room; the long-jump runway taught me that momentum is built long before the leap. As Head Boy, I learned to lead from the front.",
    tags: [
      { mark: "◆", kicker: "The stage", title: "Public Speaker", at: 0 },
      { mark: "◆", kicker: "Athletics", title: "Long Jump", at: 0.35 },
      { mark: "★", kicker: "Leadership", title: "Head Boy", at: 0.65 },
    ] as Tag[],
  },
  {
    id: "crucible",
    index: "02",
    title: "The Algorithmic Crucible",
    kicker: "Problem solving at volume",
    body: "Chaos, then order. Hundreds of problems turned instinct into structure: trees, graphs, and the discipline to find the cleanest path through them.",
    tags: [
      { mark: "500+", kicker: "DSA", title: "Problems Solved", at: 0.1 },
      { mark: "300+", kicker: "LeetCode", title: "Problems Solved", at: 0.35 },
      { mark: "4★", kicker: "CodeChef", title: "4-Star Rating", at: 0.6 },
    ] as Tag[],
  },
  {
    id: "foundation",
    index: "03",
    title: "The Foundation",
    kicker: "TechInnovation winner",
    body: "Ideas became blueprints. Winning TechInnovation proved the structures I'd been practising could stand up as a real build.",
    tags: [{ mark: "★", kicker: "Milestone", title: "TechInnovation Winner", at: 0.3 }] as Tag[],
  },
  {
    id: "scale",
    index: "04",
    title: "The Scale",
    kicker: "Corporate architecture",
    body: "Blueprints became skylines. Enterprise backends in Java, Spring Boot and PostgreSQL, built for systems where many teams and a lot of data meet.",
    tags: [
      { mark: "◆", kicker: "Corporate", title: "Infosys · ACC", at: 0.1 },
      { mark: "◆", kicker: "Java", title: "Spring Boot · PostgreSQL", at: 0.4 },
    ] as Tag[],
  },
  {
    id: "pivot",
    index: "05",
    title: "The Pivot to AI & Product",
    kicker: "EZY SIGNAL",
    body: "The rigid grid melted into something more alive. EZY SIGNAL was where engineering met product thinking and AI, and it won the Skillathon.",
    tags: [
      { mark: "◆", kicker: "AI & Product", title: "Built EZY SIGNAL", at: 0.1 },
      { mark: "★", kicker: "EZY SIGNAL", title: "Skillathon Winner", at: 0.4 },
    ] as Tag[],
  },
  {
    id: "leap",
    index: "06",
    title: "The Entrepreneurial Leap",
    kicker: "HONEST SWEET · Mesa School of Business",
    body: "Then, daylight. HONEST SWEET went from idea to ₹2+ lakh in revenue in its first four weeks, and Mesa School of Business is where I'm sharpening the founder's craft.",
    tags: [
      { mark: "◆", kicker: "Now", title: "Mesa School of Business", at: 0.1 },
      { mark: "₹2L+", kicker: "HONEST SWEET", title: "Revenue in 4 Weeks", at: 0.35 },
    ] as Tag[],
  },
] as const;

/** Points on the achievements graph, in order. `chapter` indexes `phases`; `y` is momentum, 0–100. */
export const achievements = [
  { chapter: 0, title: "Public Speaker", detail: "The stage", y: 18 },
  { chapter: 0, title: "Long Jump", detail: "Athletics", y: 24 },
  { chapter: 0, title: "Head Boy", detail: "Leadership", y: 32, win: true },
  { chapter: 1, title: "500+ DSA", detail: "Problems solved", y: 40 },
  { chapter: 1, title: "300+ LeetCode", detail: "Problems solved", y: 46 },
  { chapter: 1, title: "4★ CodeChef", detail: "Rating", y: 53 },
  { chapter: 2, title: "TechInnovation", detail: "Winner", y: 63, win: true },
  { chapter: 3, title: "Infosys ACC", detail: "Java · Spring Boot", y: 70 },
  { chapter: 4, title: "Skillathon", detail: "Winner · EZY SIGNAL", y: 82, win: true },
  { chapter: 5, title: "Mesa", detail: "School of Business", y: 88 },
  { chapter: 5, title: "HONEST SWEET", detail: "₹2L+ in 4 weeks", y: 96, win: true },
];

/** Short chapter names for the graph's x-axis. */
export const chapterNames = ["Early Drive", "Crucible", "Foundation", "Scale", "Pivot", "Leap"];
